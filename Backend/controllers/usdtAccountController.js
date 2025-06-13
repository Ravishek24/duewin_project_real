const { getModels } = require('../models');
const { Op } = require('sequelize');

// Get all USDT accounts for the authenticated user
const getUsdtAccounts = async (req, res) => {
    try {
        const models = await getModels();
        const UsdtAccount = models.UsdtAccount;

        const usdtAccounts = await UsdtAccount.findAll({
            where: { user_id: req.user.user_id },
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: usdtAccounts
        });
    } catch (error) {
        console.error('Error fetching USDT accounts:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching USDT accounts'
        });
    }
};

// Add a new USDT account
const addUsdtAccount = async (req, res) => {
    try {
        const models = await getModels();
        const UsdtAccount = models.UsdtAccount;

        const {
            address,
            network,
            remark
        } = req.body;

        // Create new USDT account
        const usdtAccount = await UsdtAccount.create({
            user_id: req.user.user_id,
            address,
            network,
            remark
        });

        res.status(201).json({
            success: true,
            message: 'USDT account added successfully',
            data: usdtAccount
        });
    } catch (error) {
        console.error('Error adding USDT account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while adding USDT account'
        });
    }
};

// Update a USDT account
const updateUsdtAccount = async (req, res) => {
    try {
        const models = await getModels();
        const UsdtAccount = models.UsdtAccount;

        const { id } = req.params;
        const {
            address,
            network,
            remark
        } = req.body;

        // Check if USDT account exists and belongs to user
        const usdtAccount = await UsdtAccount.findOne({
            where: {
                id,
                user_id: req.user.user_id
            }
        });

        if (!usdtAccount) {
            return res.status(404).json({
                success: false,
                message: 'USDT account not found'
            });
        }

        // Update USDT account
        await usdtAccount.update({
            address,
            network,
            remark
        });

        res.json({
            success: true,
            message: 'USDT account updated successfully',
            data: usdtAccount
        });
    } catch (error) {
        console.error('Error updating USDT account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating USDT account'
        });
    }
};

// Delete a USDT account
const deleteUsdtAccount = async (req, res) => {
    try {
        const models = await getModels();
        const UsdtAccount = models.UsdtAccount;

        const { id } = req.params;

        // Check if USDT account exists and belongs to user
        const usdtAccount = await UsdtAccount.findOne({
            where: {
                id,
                user_id: req.user.user_id
            }
        });

        if (!usdtAccount) {
            return res.status(404).json({
                success: false,
                message: 'USDT account not found'
            });
        }

        // Delete USDT account
        await usdtAccount.destroy();

        res.json({
            success: true,
            message: 'USDT account deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting USDT account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting USDT account'
        });
    }
};

module.exports = {
    getUsdtAccounts,
    addUsdtAccount,
    updateUsdtAccount,
    deleteUsdtAccount
};