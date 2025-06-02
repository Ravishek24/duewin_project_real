// Backend/services/vaultService.js
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

// Import models
const User = require('../models/User');
const UserVault = require('../models/UserVault');
const VaultTransaction = require('../models/VaultTransaction');
const VipLevel = require('../models/VipLevel');

/**
 * Generate unique order number for vault transactions
 */
const generateOrderNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `VLT${timestamp}${random.toString().padStart(3, '0')}`;
};

/**
 * Get or create user vault
 */
const getUserVault = async (userId, transaction = null) => {
    let vault = await UserVault.findOne({
        where: { user_id: userId },
        transaction
    });

    if (!vault) {
        vault = await UserVault.create({
            user_id: userId,
            vault_balance: 0.00,
            total_deposited: 0.00,
            total_withdrawn: 0.00,
            total_interest_earned: 0.00,
            last_interest_date: null
        }, { transaction });
    }

    return vault;
};

/**
 * Deposit money to vault from main wallet
 */
const depositToVault = async (userId, amount) => {
    const t = await sequelize.transaction();

    try {
        console.log(`💰 Depositing ${amount} to vault for user ${userId}`);

        // Get user
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) {
            throw new Error('User not found');
        }

        const depositAmount = parseFloat(amount);
        const currentWalletBalance = parseFloat(user.wallet_balance);

        // Check if user has sufficient balance
        if (currentWalletBalance < depositAmount) {
            throw new Error('Insufficient wallet balance');
        }

        // Get or create vault
        const vault = await getUserVault(userId, t);
        const currentVaultBalance = parseFloat(vault.vault_balance);

        // Generate order number
        const orderNo = generateOrderNumber();

        // Update wallet balance (deduct)
        const newWalletBalance = currentWalletBalance - depositAmount;
        await user.update({ wallet_balance: newWalletBalance }, { transaction: t });

        // Update vault balance (add)
        const newVaultBalance = currentVaultBalance + depositAmount;
        await vault.update({
            vault_balance: newVaultBalance,
            total_deposited: parseFloat(vault.total_deposited) + depositAmount
        }, { transaction: t });

        // Create vault transaction record
        await VaultTransaction.create({
            user_id: userId,
            order_no: orderNo,
            transaction_type: 'deposit',
            amount: depositAmount,
            vault_balance_before: currentVaultBalance,
            vault_balance_after: newVaultBalance,
            wallet_balance_before: currentWalletBalance,
            wallet_balance_after: newWalletBalance,
            vip_level: user.vip_level,
            status: 'completed',
            description: `Deposit to vault - Order ${orderNo}`,
            metadata: {
                operation: 'wallet_to_vault'
            }
        }, { transaction: t });

        await t.commit();

        return {
            success: true,
            message: 'Amount deposited to vault successfully',
            orderNo,
            amount: depositAmount,
            newWalletBalance,
            newVaultBalance
        };

    } catch (error) {
        await t.rollback();
        console.error('❌ Error depositing to vault:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * Withdraw money from vault to main wallet
 */
const withdrawFromVault = async (userId, amount) => {
    const t = await sequelize.transaction();

    try {
        console.log(`💸 Withdrawing ${amount} from vault for user ${userId}`);

        // Get user
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) {
            throw new Error('User not found');
        }

        // Get vault
        const vault = await getUserVault(userId, t);
        const withdrawAmount = parseFloat(amount);
        const currentVaultBalance = parseFloat(vault.vault_balance);

        // Check if vault has sufficient balance
        if (currentVaultBalance < withdrawAmount) {
            throw new Error('Insufficient vault balance');
        }

        const currentWalletBalance = parseFloat(user.wallet_balance);

        // Generate order number
        const orderNo = generateOrderNumber();

        // Update vault balance (deduct)
        const newVaultBalance = currentVaultBalance - withdrawAmount;
        await vault.update({
            vault_balance: newVaultBalance,
            total_withdrawn: parseFloat(vault.total_withdrawn) + withdrawAmount
        }, { transaction: t });

        // Update wallet balance (add)
        const newWalletBalance = currentWalletBalance + withdrawAmount;
        await user.update({ wallet_balance: newWalletBalance }, { transaction: t });

        // Create vault transaction record
        await VaultTransaction.create({
            user_id: userId,
            order_no: orderNo,
            transaction_type: 'withdrawal',
            amount: withdrawAmount,
            vault_balance_before: currentVaultBalance,
            vault_balance_after: newVaultBalance,
            wallet_balance_before: currentWalletBalance,
            wallet_balance_after: newWalletBalance,
            vip_level: user.vip_level,
            status: 'completed',
            description: `Withdrawal from vault - Order ${orderNo}`,
            metadata: {
                operation: 'vault_to_wallet'
            }
        }, { transaction: t });

        await t.commit();

        return {
            success: true,
            message: 'Amount withdrawn from vault successfully',
            orderNo,
            amount: withdrawAmount,
            newWalletBalance,
            newVaultBalance
        };

    } catch (error) {
        await t.rollback();
        console.error('❌ Error withdrawing from vault:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * Get vault status for user
 */
const getVaultStatus = async (userId) => {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'user_name', 'vip_level', 'wallet_balance'],
            include: [{
                model: VipLevel,
                foreignKey: 'vip_level',
                targetKey: 'level',
                as: 'vipuser',
                attributes: ['vault_interest_rate'],
                required: false
            }]
        });

        if (!user) {
            return { success: false, message: 'User not found' };
        }

        const vault = await getUserVault(userId);
        const currentInterestRate = user.vipuser?.vault_interest_rate || 0.00;

        return {
            success: true,
            vaultBalance: parseFloat(vault.vault_balance),
            totalDeposited: parseFloat(vault.total_deposited),
            totalWithdrawn: parseFloat(vault.total_withdrawn),
            totalInterestEarned: parseFloat(vault.total_interest_earned),
            currentInterestRate: parseFloat(currentInterestRate),
            vipLevel: user.vip_level,
            walletBalance: parseFloat(user.wallet_balance),
            lastInterestDate: vault.last_interest_date
        };

    } catch (error) {
        console.error('❌ Error getting vault status:', error);
        return {
            success: false,
            message: 'Error getting vault status: ' + error.message
        };
    }
};

/**
 * Get vault transaction history
 */
const getVaultHistory = async (userId, limit = 50, offset = 0) => {
    try {
        const transactions = await VaultTransaction.findAndCountAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            attributes: [
                'id', 'order_no', 'transaction_type', 'amount',
                'vault_balance_before', 'vault_balance_after',
                'interest_rate', 'vip_level', 'description', 'created_at'
            ]
        });

        return {
            success: true,
            transactions: transactions.rows.map(tx => ({
                id: tx.id,
                orderNo: tx.order_no,
                type: tx.transaction_type,
                amount: parseFloat(tx.amount),
                vaultBalanceBefore: parseFloat(tx.vault_balance_before),
                vaultBalanceAfter: parseFloat(tx.vault_balance_after),
                interestRate: tx.interest_rate ? parseFloat(tx.interest_rate) : null,
                vipLevel: tx.vip_level,
                description: tx.description,
                date: tx.created_at
            })),
            total: transactions.count,
            hasMore: (offset + limit) < transactions.count
        };

    } catch (error) {
        console.error('❌ Error getting vault history:', error);
        return {
            success: false,
            message: 'Error getting vault history: ' + error.message
        };
    }
};

/**
 * Process daily interest for all users (to be called by cron job)
 */
// Replace the processDailyInterest function with this version:
const processDailyInterest = async () => {
    const t = await sequelize.transaction();

    try {
        console.log('💰 Processing daily vault interest (on principal only)...');

        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');

        // Get all users with vault balance > 0
        const vaults = await UserVault.findAll({
            where: {
                vault_balance: { [Op.gt]: 0 },
                [Op.or]: [
                    { last_interest_date: null },
                    { last_interest_date: { [Op.lt]: today } }
                ]
            },
            include: [{
                model: User,
                as: 'vaultuser',
                attributes: ['user_id', 'vip_level'],
                include: [{
                    model: VipLevel,
                    foreignKey: 'vip_level',
                    targetKey: 'level',
                    as: 'vipuser',
                    attributes: ['vault_interest_rate'],
                    required: false
                }]
            }],
            transaction: t
        });

        let processedCount = 0;
        let totalInterestPaid = 0;

        for (const vault of vaults) {
            try {
                const user = vault.vaultuser;
                const interestRate = user.vipuser?.vault_interest_rate || 0.00;

                if (interestRate > 0) {
                    const dailyInterestRate = parseFloat(interestRate) / 100; // Convert percentage to decimal
                    
                    // Calculate interest ONLY on principal (total_deposited - total_withdrawn)
                    const principalAmount = parseFloat(vault.total_deposited) - parseFloat(vault.total_withdrawn);
                    const interestAmount = principalAmount * dailyInterestRate;

                    if (interestAmount > 0 && principalAmount > 0) {
                        const orderNo = generateOrderNumber();

                        // Update vault balance (add interest) and total interest earned
                        const currentVaultBalance = parseFloat(vault.vault_balance);
                        const newVaultBalance = currentVaultBalance + interestAmount;
                        
                        await vault.update({
                            vault_balance: newVaultBalance,
                            total_interest_earned: parseFloat(vault.total_interest_earned) + interestAmount,
                            last_interest_date: today
                        }, { transaction: t });

                        // Create interest transaction record
                        await VaultTransaction.create({
                            user_id: user.user_id,
                            order_no: orderNo,
                            transaction_type: 'interest',
                            amount: interestAmount,
                            vault_balance_before: currentVaultBalance,
                            vault_balance_after: newVaultBalance,
                            interest_rate: dailyInterestRate,
                            vip_level: user.vip_level,
                            status: 'completed',
                            description: `Daily vault interest - ${today} (${parseFloat(interestRate)}% on principal)`,
                            metadata: {
                                interest_date: today,
                                rate_applied: interestRate,
                                principal_amount: principalAmount,
                                calculation_method: 'principal_only'
                            }
                        }, { transaction: t });

                        processedCount++;
                        totalInterestPaid += interestAmount;
                    }
                }

                // Update last interest date even if no interest was paid
                await vault.update({
                    last_interest_date: today
                }, { transaction: t });

            } catch (userError) {
                console.error(`❌ Error processing interest for user ${vault.user_id}:`, userError);
            }
        }

        await t.commit();

        console.log(`✅ Daily interest processed: ${processedCount} users, Total: ${totalInterestPaid}`);

        return {
            success: true,
            processedUsers: processedCount,
            totalInterestPaid
        };

    } catch (error) {
        await t.rollback();
        console.error('❌ Error processing daily interest:', error);
        return {
            success: false,
            message: 'Error processing daily interest: ' + error.message
        };
    }
};

module.exports = {
    depositToVault,
    withdrawFromVault,
    getVaultStatus,
    getVaultHistory,
    processDailyInterest,
    getUserVault
};