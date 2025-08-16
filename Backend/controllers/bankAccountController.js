const { getModels } = require('../models');
const { Op } = require('sequelize');

// Get all bank accounts for the authenticated user
const getBankAccountsController = async (req, res) => {
    try {
        const models = await getModels();
        const BankAccount = models.BankAccount;

        const bankAccounts = await BankAccount.findAll({
            where: { user_id: req.user.user_id },
            order: [['is_primary', 'DESC'], ['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: bankAccounts
        });
    } catch (error) {
        console.error('Error fetching bank accounts:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching bank accounts'
        });
    }
};

// Add a new bank account
const addBankAccountController = async (req, res) => {
    try {
        const models = await getModels();
        const BankAccount = models.BankAccount;

        const {
            bank_name,
            account_number,
            ifsc_code,
            account_holder_name,
            is_primary = false
        } = req.body;

        // Check if bank account number already exists (globally unique)
        const existingAccount = await BankAccount.findOne({
            where: { account_number: account_number }
        });

        if (existingAccount) {
            return res.status(400).json({
                success: false,
                message: 'Bank account number already exists. Please use a different account number.'
            });
        }

        // If this is set as primary, unset any existing primary account
        if (is_primary) {
            await BankAccount.update(
                { is_primary: false },
                {
                    where: {
                        user_id: req.user.user_id,
                        is_primary: true
                    }
                }
            );
        }

        // Create new bank account
        const bankAccount = await BankAccount.create({
            user_id: req.user.user_id,
            bank_name,
            account_number,
            ifsc_code,
            account_holder: account_holder_name,
            is_primary
        });

        res.status(201).json({
            success: true,
            message: 'Bank account added successfully',
            data: bankAccount
        });
    } catch (error) {
        console.error('Error adding bank account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while adding bank account'
        });
    }
};

// Update a bank account
const updateBankAccountController = async (req, res) => {
    try {
        const models = await getModels();
        const BankAccount = models.BankAccount;

        const { id } = req.params;
        const {
            bank_name,
            account_number,
            ifsc_code,
            account_holder_name,
            is_primary
        } = req.body;

        // Check if bank account exists and belongs to user
        const bankAccount = await BankAccount.findOne({
            where: {
                id,
                user_id: req.user.user_id
            }
        });

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: 'Bank account not found'
            });
        }

        // If updating account number, check for duplicates
        if (account_number && account_number !== bankAccount.account_number) {
            const existingAccountNumber = await BankAccount.findOne({
                where: { 
                    account_number: account_number,
                    id: { [Op.ne]: id } // Exclude current account
                }
            });
            
            if (existingAccountNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'Bank account number already exists. Please use a different account number.'
                });
            }
        }

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: 'Bank account not found'
            });
        }

        // If setting as primary, unset any existing primary account
        if (is_primary) {
            await BankAccount.update(
                { is_primary: false },
                {
                    where: {
                        user_id: req.user.user_id,
                        is_primary: true,
                        id: { [Op.ne]: id }
                    }
                }
            );
        }

        // Update bank account
        await bankAccount.update({
            bank_name,
            account_number,
            ifsc_code,
            account_holder: account_holder_name,
            is_primary
        });

        res.json({
            success: true,
            message: 'Bank account updated successfully',
            data: bankAccount
        });
    } catch (error) {
        console.error('Error updating bank account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating bank account'
        });
    }
};

// Delete a bank account
const deleteBankAccountController = async (req, res) => {
    try {
        const models = await getModels();
        const BankAccount = models.BankAccount;

        const { id } = req.params;

        // Check if bank account exists and belongs to user
        const bankAccount = await BankAccount.findOne({
            where: {
                id,
                user_id: req.user.user_id
            }
        });

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: 'Bank account not found'
            });
        }

        // Delete bank account
        await bankAccount.destroy();

        res.json({
            success: true,
            message: 'Bank account deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting bank account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting bank account'
        });
    }
};

module.exports = {
    getBankAccountsController,
    addBankAccountController,
    updateBankAccountController,
    deleteBankAccountController
};