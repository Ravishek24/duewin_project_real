import {
    createPayInOrder,
    createPayOutOrder,
    processPayInCallback,
    processPayOutCallback,
    getPaymentStatus,
  } from '../services/paymentService.js';
  
  // Controller to handle payment creation (adding money to wallet)
  export const payInController = async (req, res) => {
    try {
      const { amount, pay_type = 'UPI' } = req.body;
      const userId = req.user.user_id;
  
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid amount provided'
        });
      }
  
      // Create a unique order ID based on timestamp
      const orderId = `PI${Date.now()}${userId}`;
  
      // Get host for callback URL
      const host = `${req.protocol}://${req.get('host')}`;
      const notifyUrl = `${host}/api/payments/payin-callback`;
  
      // Create payment order
      const result = await createPayInOrder(userId, orderId, pay_type, amount, notifyUrl);
  
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error creating payment order'
      });
    }
  };
  
  // Controller to handle payment withdrawal (withdrawing money from wallet)
  export const payOutController = async (req, res) => {
    try {
      const { amount, bank_account_id, withdrawal_type = 'BANK' } = req.body;
      const userId = req.user.user_id;
  
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid amount provided'
        });
      }
  
      if (!bank_account_id) {
        return res.status(400).json({
          success: false,
          message: 'Bank account ID is required'
        });
      }
  
      // Get host for callback URL
      const host = `${req.protocol}://${req.get('host')}`;
      const notifyUrl = `${host}/api/payments/payout-callback`;
  
      // Create payout order
      const result = await createPayOutOrder(userId, bank_account_id, amount, withdrawal_type, notifyUrl);
  
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error creating withdrawal:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error creating withdrawal order'
      });
    }
  };
  
  // Controller to handle payment callbacks from payment gateway (PayIn)
  export const payInCallbackController = async (req, res) => {
    try {
      const callbackData = req.body;
      const result = await processPayInCallback(callbackData);
      
      if (result.success) {
        // Return "success" (must be exactly this string for payment gateway)
        return res.send('success');
      } else {
        // Still return success to stop further callbacks, but log error
        console.error('Error processing payment callback:', result.message);
        return res.send('success');
      }
    } catch (error) {
      console.error('Payment callback error:', error);
      return res.send('success'); // Still return success to prevent retries
    }
  };
  
  // Controller to handle payout callbacks from payment gateway
  export const payOutCallbackController = async (req, res) => {
    try {
      const callbackData = req.body;
      const result = await processPayOutCallback(callbackData);
      
      if (result.success) {
        // Return "success" (must be exactly this string for payment gateway)
        return res.send('success');
      } else {
        // Still return success to stop further callbacks, but log error
        console.error('Error processing payout callback:', result.message);
        return res.send('success');
      }
    } catch (error) {
      console.error('Payout callback error:', error);
      return res.send('success'); // Still return success to prevent retries
    }
  };
  
  // Controller to check payment status
  export const getPaymentStatusController = async (req, res) => {
    try {
      const { order_id } = req.params;
      
      if (!order_id) {
        return res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
      }
      
      const result = await getPaymentStatus(order_id);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Error checking payment status:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error checking payment status'
      });
    }
  };
  
  export default {
    payInController,
    payOutController,
    payInCallbackController,
    payOutCallbackController,
    getPaymentStatusController
  };