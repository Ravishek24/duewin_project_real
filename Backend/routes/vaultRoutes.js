const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/authMiddleware');
const vaultService = require('../services/vaultService');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Validation schemas
const depositSchema = Joi.object({
    amount: Joi.number().positive().required()
});

const withdrawSchema = Joi.object({
    amount: Joi.number().positive().required()
});

const historySchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0)
});

/**
 * @route POST /api/vault/deposit
 * @desc Deposit money from wallet to vault
 * @access Private
 */
router.post('/deposit', 
    auth,
    validateRequest(depositSchema),
    async (req, res) => {
        try {
            const { amount } = req.body;
            const userId = req.user.user_id;

            const result = await vaultService.depositToVault(userId, amount);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error('Error in vault deposit:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route POST /api/vault/withdraw
 * @desc Withdraw money from vault to wallet
 * @access Private
 */
router.post('/withdraw',
    auth,
    validateRequest(withdrawSchema),
    async (req, res) => {
        try {
            const { amount } = req.body;
            const userId = req.user.user_id;

            const result = await vaultService.withdrawFromVault(userId, amount);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error('Error in vault withdrawal:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route GET /api/vault/status
 * @desc Get vault status and statistics
 * @access Private
 */
router.get('/status',
    auth,
    async (req, res) => {
        try {
            const userId = req.user.user_id;
            const result = await vaultService.getVaultStatus(userId);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error('Error getting vault status:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route GET /api/vault/history
 * @desc Get vault transaction history
 * @access Private
 */
router.get('/history',
    auth,
    validateRequest(historySchema, 'query'),
    async (req, res) => {
        try {
            const userId = req.user.user_id;
            const { limit, offset } = req.query;

            const result = await vaultService.getVaultHistory(userId, limit, offset);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error('Error getting vault history:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
);

module.exports = router; 