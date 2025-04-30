import BankAccount from '../models/BankAccount.js';
import User from '../models/User.js';
import { sequelize } from '../config/db.js';
import otpService from './otpService.js';

// Service to get user's bank accounts
export const getBankAccounts = async (userId) => {
    try {
        const bankAccounts = await BankAccount.findAll({
            where: { user_id: userId },
            order: [['is_primary', 'DESC'], ['created_at', 'DESC']]
        });

        return {
            success: true,
            bankAccounts: bankAccounts
        };
    } catch (error) {
        console.error('Error fetching bank accounts:', error);
        return {
            success: false,
            message: 'Server error fetching bank accounts.'
        };
    }
};

// Service to initialize bank account addition with OTP verification
export const initBankAccountAddition = async (userId, accountData) => {
    try {
        // Validate required fields
        const { account_holder_name, account_number, bank_name, ifsc_code } = accountData;
        if (!account_holder_name || !account_number || !bank_name || !ifsc_code) {
            return {
                success: false,
                message: 'Please provide all required fields: account holder name, account number, bank name, and IFSC code.'
            };
        }
        
        // Check if user exists
        const user = await User.findByPk(userId);
        if (!user) {
            return {
                success: false,
                message: 'User not found.'
            };
        }
        
        // Generate and send OTP for verification
        const country_code = '91'; // Default to India
        const otpResponse = await otpService.createOtpSession(
            user.phone_no,
            country_code,
            user.user_name,
            { 
                udf1: JSON.stringify(accountData), // Store account data in udf1
                udf2: 'bank_add' // Action type
            }
        );
        
        if (!otpResponse.success) {
            return {
                success: false,
                message: `Failed to send OTP: ${otpResponse.message}`
            };
        }
        
        // Update user with OTP session ID
        await User.update(
            { phone_otp_session_id: otpResponse.otpSessionId.toString() },
            { where: { user_id: userId } }
        );
        
        return {
            success: true,
            message: 'OTP sent for verification. Please verify to add bank account.',
            otpSessionId: otpResponse.otpSessionId,
            requiresVerification: true
        };
    } catch (error) {
        console.error('Error initializing bank account addition:', error);
        return {
            success: false,
            message: 'Server error initializing bank account addition.'
        };
    }
};

// Service to complete bank account addition after OTP verification
export const completeBankAccountAddition = async (userId, otpSessionId) => {
    const t = await sequelize.transaction();

    try {
        // Get user
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) {
            await t.rollback();
            return {
                success: false,
                message: 'User not found.'
            };
        }
        
        // Verify OTP session ID matches
        if (user.phone_otp_session_id !== otpSessionId.toString()) {
            await t.rollback();
            return {
                success: false,
                message: 'Invalid OTP session for this user.'
            };
        }
        
        // Check OTP verification status
        const otpVerificationResult = await otpService.checkOtpSession(otpSessionId);
        
        if (!otpVerificationResult.success) {
            await t.rollback();
            return {
                success: false,
                message: `OTP verification failed: ${otpVerificationResult.message}`
            };
        }
        
        // If OTP is not verified yet
        if (!otpVerificationResult.verified) {
            await t.rollback();
            return {
                success: false,
                message: 'OTP has not been verified yet.',
                status: otpVerificationResult.status
            };
        }
        
        // Extract account data from OTP session (stored in udf1)
        const accountData = JSON.parse(otpVerificationResult.userData.udf1);
        
        // Check if this is the first account (should be primary)
        const existingAccounts = await BankAccount.count({
            where: { user_id: userId },
            transaction: t
        });

        const shouldBePrimary = existingAccounts === 0 ? true : accountData.is_primary;

        // If this account should be primary, unset primary from all other accounts
        if (shouldBePrimary) {
            await BankAccount.update(
                { is_primary: false },
                { 
                    where: { user_id: userId },
                    transaction: t 
                }
            );
        }

        // Create the new bank account
        const newBankAccount = await BankAccount.create({
            user_id: userId,
            account_holder_name: accountData.account_holder_name,
            account_number: accountData.account_number,
            bank_name: accountData.bank_name,
            ifsc_code: accountData.ifsc_code,
            branch_name: accountData.branch_name || null,
            is_primary: shouldBePrimary,
            is_verified: true // Mark as verified since OTP verified
        }, { transaction: t });
        
        // Clear OTP session ID
        await User.update(
            { phone_otp_session_id: null },
            { where: { user_id: userId }, transaction: t }
        );

        await t.commit();

        return {
            success: true,
            message: 'Bank account added and verified successfully.',
            bankAccount: newBankAccount
        };
    } catch (error) {
        await t.rollback();
        console.error('Error completing bank account addition:', error);
        return {
            success: false,
            message: 'Server error completing bank account addition.'
        };
    }
};

// Service to update a bank account
export const updateBankAccount = async (userId, accountId, accountData) => {
    const t = await sequelize.transaction();

    try {
        // Check if the account exists and belongs to the user
        const bankAccount = await BankAccount.findOne({
            where: {
                bank_account_id: accountId,
                user_id: userId
            },
            transaction: t
        });

        if (!bankAccount) {
            await t.rollback();
            return {
                success: false,
                message: 'Bank account not found or does not belong to the user.'
            };
        }

        const { 
            account_holder_name, 
            bank_name, 
            ifsc_code, 
            branch_name,
            is_primary 
        } = accountData;

        // If this account should be primary, unset primary from all other accounts
        if (is_primary) {
            await BankAccount.update(
                { is_primary: false },
                { 
                    where: { user_id: userId },
                    transaction: t 
                }
            );
        }

        // Update the bank account
        await BankAccount.update(
            {
                account_holder_name: account_holder_name || bankAccount.account_holder_name,
                bank_name: bank_name || bankAccount.bank_name,
                ifsc_code: ifsc_code || bankAccount.ifsc_code,
                branch_name: branch_name !== undefined ? branch_name : bankAccount.branch_name,
                is_primary: is_primary !== undefined ? is_primary : bankAccount.is_primary
            },
            {
                where: {
                    bank_account_id: accountId,
                    user_id: userId
                },
                transaction: t
            }
        );

        // Get the updated bank account
        const updatedBankAccount = await BankAccount.findByPk(accountId, { transaction: t });

        await t.commit();

        return {
            success: true,
            message: 'Bank account updated successfully.',
            bankAccount: updatedBankAccount
        };
    } catch (error) {
        await t.rollback();
        console.error('Error updating bank account:', error);
        return {
            success: false,
            message: 'Server error updating bank account.'
        };
    }
};

// Service to delete a bank account
export const deleteBankAccount = async (userId, accountId) => {
    const t = await sequelize.transaction();

    try {
        // Check if the account exists and belongs to the user
        const bankAccount = await BankAccount.findOne({
            where: {
                bank_account_id: accountId,
                user_id: userId
            },
            transaction: t
        });

        if (!bankAccount) {
            await t.rollback();
            return {
                success: false,
                message: 'Bank account not found or does not belong to the user.'
            };
        }

        const wasPrimary = bankAccount.is_primary;

        // Delete the bank account
        await BankAccount.destroy({
            where: {
                bank_account_id: accountId,
                user_id: userId
            },
            transaction: t
        });

        // If this was a primary account, set another account as primary
        if (wasPrimary) {
            const anotherAccount = await BankAccount.findOne({
                where: { user_id: userId },
                order: [['created_at', 'DESC']],
                transaction: t
            });

            if (anotherAccount) {
                await BankAccount.update(
                    { is_primary: true },
                    { 
                        where: { bank_account_id: anotherAccount.bank_account_id },
                        transaction: t 
                    }
                );
            }
        }

        await t.commit();

        return {
            success: true,
            message: 'Bank account deleted successfully.'
        };
    } catch (error) {
        await t.rollback();
        console.error('Error deleting bank account:', error);
        return {
            success: false,
            message: 'Server error deleting bank account.'
        };
    }
};

export default {
    getBankAccounts,
    initBankAccountAddition,
    completeBankAccountAddition,
    updateBankAccount,
    deleteBankAccount
};