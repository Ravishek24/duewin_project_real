// controllers/mxPayController.js
import {
    createMxPayCollectionOrder,
    processMxPayCollectionCallback,
    checkMxPayCollectionStatus,
    processMxPayTransfer,
    processMxPayTransferCallback,
    getMxPayBankList,
    checkMxPayMerchantBalance
} from '../services/mxPayService.js';

/**
 * Controller to handle MxPay deposit (collection) creation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const mxPayDepositController = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.user_id;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount provided'
            });
        }

        // Create a unique order ID
        const orderId = `MXPAY${Date.now()}${userId}`;

        // Get host for callback URL
        const host = `${req.protocol}://${req.get('host')}`;
        const notifyUrl = `${host}/api/payments/mxpay/collection-callback`;
        const returnUrl = `${process.env.FRONTEND_URL}/wallet`;

        // Create the collection order
        const result = await createMxPayCollectionOrder(userId, orderId, amount, notifyUrl, returnUrl);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error creating MxPay deposit:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error creating payment order'
        });
    }
};

/**
 * Controller to handle MxPay collection callbacks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const mxPayCollectionCallbackController = async (req, res) => {
    try {
        const callbackData = req.body;
        console.log('MxPay collection callback received:', callbackData);

        const result = await processMxPayCollectionCallback(callbackData);

        if (result.success) {
            // API requires returning "ok" exactly for success
            return res.send('ok');
        } else {
            console.error('Error processing MxPay collection callback:', result.message);
            return res.send('ok'); // Still return "ok" to stop repeated callbacks
        }
    } catch (error) {
        console.error('MxPay collection callback error:', error);
        return res.send('ok'); // Still return "ok" to prevent retries
    }
};

/**
 * Controller to handle MxPay order status check
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const checkMxPayOrderStatusController = async (req, res) => {
    try {
        const { order_id } = req.params;

        if (!order_id) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        const result = await checkMxPayCollectionStatus(order_id);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error checking MxPay order status:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error checking order status'
        });
    }
};

// controllers/mxPayController.js (continuation)

/**
 * Controller to handle MxPay transfer callbacks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const mxPayTransferCallbackController = async (req, res) => {
    try {
        const callbackData = req.body;
        console.log('MxPay transfer callback received:', callbackData);

        const result = await processMxPayTransferCallback(callbackData);

        if (result.success) {
            // API requires returning "ok" exactly for success
            return res.send('ok');
        } else {
            console.error('Error processing MxPay transfer callback:', result.message);
            return res.send('ok'); // Still return "ok" to stop repeated callbacks
        }
    } catch (error) {
        console.error('MxPay transfer callback error:', error);
        return res.send('ok'); // Still return "ok" to prevent retries
    }
};

/**
 * Controller to get available bank list for transfers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getMxPayBankListController = async (req, res) => {
    try {
        const result = await getMxPayBankList();

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error getting MxPay bank list:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting bank list'
        });
    }
};

/**
 * Controller to check merchant balance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const checkMxPayMerchantBalanceController = async (req, res) => {
    try {
        const result = await checkMxPayMerchantBalance();

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error checking MxPay merchant balance:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error checking merchant balance'
        });
    }
};

/**
 * Controller to execute manual payout using MxPay
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const processMxPayPayoutController = async (req, res) => {
    try {
        const { withdrawal_id } = req.params;

        if (!withdrawal_id) {
            return res.status(400).json({
                success: false,
                message: 'Withdrawal ID is required'
            });
        }

        // Get host for callback URL
        const host = `${req.protocol}://${req.get('host')}`;
        const notifyUrl = `${host}/api/payments/mxpay/transfer-callback`;

        // Process the payout
        const result = await processMxPayTransfer(withdrawal_id, notifyUrl);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error processing MxPay payout:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error processing payout'
        });
    }
};

export default {
    mxPayDepositController,
    mxPayCollectionCallbackController,
    checkMxPayOrderStatusController,
    mxPayTransferCallbackController,
    getMxPayBankListController,
    checkMxPayMerchantBalanceController,
    processMxPayPayoutController
};