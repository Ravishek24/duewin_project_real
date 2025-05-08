const UsdtAccount = require('../models/UsdtAccount');
const { sequelize } = require('../config/db');

// Service to get user's USDT accounts
const getUsdtAccounts = async (userId) => {
    try {
        const usdtAccounts = await UsdtAccount.findAll({
            where: { user_id: userId },
            order: [['is_primary', 'DESC'], ['created_at', 'DESC']]
        });

        return {
            success: true,
            usdtAccounts: usdtAccounts
        };
    } catch (error) {
        console.error('Error fetching USDT accounts:', error);
        return {
            success: false,
            message: 'Server error fetching USDT accounts.'
        };
    }
};

// Service to add a USDT account
const addUsdtAccount = async (userId, accountData) => {
    const t = await sequelize.transaction();

    try {
        const { 
            wallet_address, 
            network_type,
            is_primary = false 
        } = accountData;

        // Check if this is the first account (should be primary)
        const existingAccounts = await UsdtAccount.count({
            where: { user_id: userId },
            transaction: t
        });

        const shouldBePrimary = existingAccounts === 0 ? true : is_primary;

        // If this account should be primary, unset primary from all other accounts
        if (shouldBePrimary) {
            await UsdtAccount.update(
                { is_primary: false },
                { 
                    where: { user_id: userId },
                    transaction: t 
                }
            );
        }

        // Create the new USDT account
        const newUsdtAccount = await UsdtAccount.create({
            user_id: userId,
            wallet_address,
            network_type,
            is_primary: shouldBePrimary
        }, { transaction: t });

        await t.commit();

        return {
            success: true,
            message: 'USDT account added successfully.',
            usdtAccount: newUsdtAccount
        };
    } catch (error) {
        await t.rollback();
        console.error('Error adding USDT account:', error);
        return {
            success: false,
            message: 'Server error adding USDT account.'
        };
    }
};

// Service to update a USDT account
const updateUsdtAccount = async (userId, accountId, accountData) => {
    const t = await sequelize.transaction();

    try {
        // Check if the account exists and belongs to the user
        const usdtAccount = await UsdtAccount.findOne({
            where: {
                usdt_account_id: accountId,
                user_id: userId
            },
            transaction: t
        });

        if (!usdtAccount) {
            await t.rollback();
            return {
                success: false,
                message: 'USDT account not found or does not belong to the user.'
            };
        }

        const { 
            wallet_address, 
            network_type,
            is_primary 
        } = accountData;

        // If this account should be primary, unset primary from all other accounts
        if (is_primary) {
            await UsdtAccount.update(
                { is_primary: false },
                { 
                    where: { user_id: userId },
                    transaction: t 
                }
            );
        }

        // Update the USDT account
        await UsdtAccount.update(
            {
                wallet_address: wallet_address || usdtAccount.wallet_address,
                network_type: network_type || usdtAccount.network_type,
                is_primary: is_primary !== undefined ? is_primary : usdtAccount.is_primary
            },
            {
                where: {
                    usdt_account_id: accountId,
                    user_id: userId
                },
                transaction: t
            }
        );

        // Get the updated USDT account
        const updatedUsdtAccount = await UsdtAccount.findByPk(accountId, { transaction: t });

        await t.commit();

        return {
            success: true,
            message: 'USDT account updated successfully.',
            usdtAccount: updatedUsdtAccount
        };
    } catch (error) {
        await t.rollback();
        console.error('Error updating USDT account:', error);
        return {
            success: false,
            message: 'Server error updating USDT account.'
        };
    }
};

// Service to delete a USDT account
const deleteUsdtAccount = async (userId, accountId) => {
    const t = await sequelize.transaction();

    try {
        // Check if the account exists and belongs to the user
        const usdtAccount = await UsdtAccount.findOne({
            where: {
                usdt_account_id: accountId,
                user_id: userId
            },
            transaction: t
        });

        if (!usdtAccount) {
            await t.rollback();
            return {
                success: false,
                message: 'USDT account not found or does not belong to the user.'
            };
        }

        const wasPrimary = usdtAccount.is_primary;

        // Delete the USDT account
        await UsdtAccount.destroy({
            where: {
                usdt_account_id: accountId,
                user_id: userId
            },
            transaction: t
        });

        // If this was a primary account, set another account as primary
        if (wasPrimary) {
            const anotherAccount = await UsdtAccount.findOne({
                where: { user_id: userId },
                order: [['created_at', 'DESC']],
                transaction: t
            });

            if (anotherAccount) {
                await UsdtAccount.update(
                    { is_primary: true },
                    { 
                        where: { usdt_account_id: anotherAccount.usdt_account_id },
                        transaction: t 
                    }
                );
            }
        }

        await t.commit();

        return {
            success: true,
            message: 'USDT account deleted successfully.'
        };
    } catch (error) {
        await t.rollback();
        console.error('Error deleting USDT account:', error);
        return {
            success: false,
            message: 'Server error deleting USDT account.'
        };
    }
};

module.exports = {
    getUsdtAccounts,
    addUsdtAccount,
    updateUsdtAccount,
    deleteUsdtAccount
};