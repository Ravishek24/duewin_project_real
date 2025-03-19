import BankAccount from '../models/BankAccount.js';
import { sequelize } from '../config/db.js';

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

// Service to add a bank account
export const addBankAccount = async (userId, accountData) => {
    const t = await sequelize.transaction();

    try {
        const { 
            account_holder_name, 
            account_number, 
            bank_name, 
            ifsc_code, 
            branch_name = null,
            is_primary = false 
        } = accountData;

        // Check if this is the first account (should be primary)
        const existingAccounts = await BankAccount.count({
            where: { user_id: userId },
            transaction: t
        });

        const shouldBePrimary = existingAccounts === 0 ? true : is_primary;

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
            account_holder_name,
            account_number,
            bank_name,
            ifsc_code,
            branch_name,
            is_primary: shouldBePrimary
        }, { transaction: t });

        await t.commit();

        return {
            success: true,
            message: 'Bank account added successfully.',
            bankAccount: newBankAccount
        };
    } catch (error) {
        await t.rollback();
        console.error('Error adding bank account:', error);
        return {
            success: false,
            message: 'Server error adding bank account.'
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
    addBankAccount,
    updateBankAccount,
    deleteBankAccount
};