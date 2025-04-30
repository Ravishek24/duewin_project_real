import {
  createPayInOrder,
  initiateWithdrawal,
  verifyWithdrawalOtp,
  processPayInCallback,
  processPayOutCallback,
  getPaymentStatus,
} from '../services/paymentService.js';

import {
  createWePayCollectionOrder,
  processWePayCollectionCallback,
  processWePayTransferCallback
} from '../services/wePayService.js';

// Controller to handle payment creation (adding money to wallet) with gateway selection
export const payInController = async (req, res) => {
  try {
      const { amount, pay_type = 'UPI', gateway = 'OKPAY' } = req.body;
      const userId = req.user.user_id;

      if (!amount || parseFloat(amount) <= 0) {
          return res.status(400).json({
              success: false,
              message: 'Invalid amount provided'
          });
      }

      // Create a unique order ID based on timestamp and gateway
      const orderId = `PI${gateway.substring(0,2)}${Date.now()}${userId}`;

      // Get host for callback URL
      const host = `${req.protocol}://${req.get('host')}`;
      const notifyUrl = `${host}/api/payments/${gateway.toLowerCase()}/payin-callback`;
      const returnUrl = `${process.env.FRONTEND_URL}/wallet`;

      let result;
      
      // Choose the appropriate payment gateway
      if (gateway === 'WEPAY') {
          // Use WePay payment gateway
          result = await createWePayCollectionOrder(userId, orderId, amount, notifyUrl, returnUrl);
      } else {
          // Default to OKPAY payment gateway
          result = await createPayInOrder(userId, orderId, pay_type, amount, notifyUrl);
      }

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

// Controller to initiate a withdrawal request with OTP verification
export const initiateWithdrawalController = async (req, res) => {
  try {
      const { amount, bank_account_id, withdrawal_type = 'BANK', gateway = 'OKPAY' } = req.body;
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

      // Store gateway choice in the OTP data for later use
      const userData = {
          bank_account_id,
          amount,
          withdrawal_type,
          gateway
      };

      // Initiate withdrawal and send OTP
      const result = await initiateWithdrawal(userId, bank_account_id, amount, withdrawal_type);

      if (result.success) {
          return res.status(200).json(result);
      } else {
          return res.status(400).json(result);
      }
  } catch (error) {
      console.error('Error initiating withdrawal:', error);
      return res.status(500).json({
          success: false,
          message: 'Server error initiating withdrawal'
      });
  }
};

// Controller to verify OTP and complete withdrawal submission for admin approval
export const verifyWithdrawalOtpController = async (req, res) => {
  try {
      const { otp_session_id, gateway = 'OKPAY' } = req.body;
      const userId = req.user.user_id;

      if (!otp_session_id) {
          return res.status(400).json({
              success: false,
              message: 'OTP session ID is required'
          });
      }

      // Verify OTP and create withdrawal for admin approval
      // The gateway will be stored in the withdrawal record for later processing
      const result = await verifyWithdrawalOtp(userId, otp_session_id, gateway);

      if (result.success) {
          return res.status(200).json(result);
      } else {
          return res.status(400).json(result);
      }
  } catch (error) {
      console.error('Error verifying withdrawal OTP:', error);
      return res.status(500).json({
          success: false,
          message: 'Server error verifying withdrawal OTP'
      });
  }
};

// Controller to handle OKPAY payment callbacks
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

// Controller to handle OKPAY payout callbacks
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

// Controller to handle WePay collection callbacks
export const wePayCollectionCallbackController = async (req, res) => {
  try {
      const callbackData = req.body;
      const result = await processWePayCollectionCallback(callbackData);
      
      if (result.success) {
          // Return "success" (must be exactly this string for payment gateway)
          return res.send('success');
      } else {
          // Still return success to stop further callbacks, but log error
          console.error('Error processing WePay collection callback:', result.message);
          return res.send('success');
      }
  } catch (error) {
      console.error('WePay collection callback error:', error);
      return res.send('success'); // Still return success to prevent retries
  }
};

// Controller to handle WePay transfer callbacks
export const wePayTransferCallbackController = async (req, res) => {
  try {
      const callbackData = req.body;
      const result = await processWePayTransferCallback(callbackData);
      
      if (result.success) {
          // Return "success" (must be exactly this string for payment gateway)
          return res.send('success');
      } else {
          // Still return success to stop further callbacks, but log error
          console.error('Error processing WePay transfer callback:', result.message);
          return res.send('success');
      }
  } catch (error) {
      console.error('WePay transfer callback error:', error);
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
  initiateWithdrawalController,
  verifyWithdrawalOtpController,
  payInCallbackController,
  payOutCallbackController,
  wePayCollectionCallbackController,
  wePayTransferCallbackController,
  getPaymentStatusController
};