const {
  createPayInOrder,
  initiateWithdrawal,
  verifyWithdrawalOtp,
  processPayInCallback,
  processPayOutCallback,
  getPaymentStatus,
} = require('../services/paymentService');

const {
  createWePayCollectionOrder,
  processWePayCollectionCallback,
  processWePayTransferCallback
} = require('../services/wePayService');

// Controller to handle payment creation (adding money to wallet) with gateway selection
// Updated section for paymentController.js to include MxPay

// Import the new MxPay service
const { createMxPayCollectionOrder } = require('../services/mxPayService');

// Update the payInController to support MxPay
const payInController = async (req, res) => {
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
    const orderId = `PI${gateway.substring(0, 2)}${Date.now()}${userId}`;

    // Get host for callback URL
    const host = `${req.protocol}://${req.get('host')}`;
    let notifyUrl = '';
    let returnUrl = `${process.env.FRONTEND_URL}/wallet`;

    // Find the payment gateway ID by code
    const paymentGateway = await PaymentGateway.findOne({
      where: { code: gateway, is_active: true }
    });

    if (!paymentGateway) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive payment gateway'
      });
    }

    // Set the appropriate callback URL based on gateway
    switch (gateway) {
      case 'WEPAY':
        notifyUrl = `${host}/api/payments/wepay/payin-callback`;
        break;
      case 'MXPAY':
        notifyUrl = `${host}/api/payments/mxpay/collection-callback`;
        break;
      default: // OKPAY or any other
        notifyUrl = `${host}/api/payments/okpay/payin-callback`;
        break;
    }

    let result;

    // Choose the appropriate payment gateway
    switch (gateway) {
      case 'WEPAY':
        // Use WePay payment gateway
        result = await createWePayCollectionOrder(userId, orderId, amount, notifyUrl, returnUrl, paymentGateway.gateway_id);
        break;
      case 'MXPAY':
        // Use MxPay payment gateway
        result = await createMxPayCollectionOrder(userId, orderId, amount, notifyUrl, returnUrl, paymentGateway.gateway_id);
        break;
      default:
        // Default to OKPAY payment gateway
        result = await createPayInOrder(userId, orderId, pay_type, amount, notifyUrl, paymentGateway.gateway_id);
        break;
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

// Update the processWithdrawalAdminAction function to support MxPay
const processWithdrawalAdminAction = async (adminId, withdrawalId, action, notes = '') => {
  const t = await sequelize.transaction();

  try {
    // Get withdrawal
    const withdrawal = await WalletWithdrawal.findByPk(withdrawalId, {
      transaction: t
    });

    if (!withdrawal) {
      await t.rollback();
      return {
        success: false,
        message: "Withdrawal not found"
      };
    }

    // Check if withdrawal can be processed
    if (withdrawal.admin_status !== 'pending') {
      await t.rollback();
      return {
        success: false,
        message: `This withdrawal has already been ${withdrawal.admin_status}`
      };
    }

    if (!withdrawal.otp_verified) {
      await t.rollback();
      return {
        success: false,
        message: "This withdrawal has not been verified by the user yet"
      };
    }

    // Get the admin record
    const adminRecord = await WithdrawalAdmin.findOne({
      where: { withdrawal_id: withdrawalId },
      transaction: t
    });

    if (!adminRecord) {
      await t.rollback();
      return {
        success: false,
        message: "Admin record not found for this withdrawal"
      };
    }

    // Update admin record
    await adminRecord.update({
      admin_id: adminId,
      status: action === 'approve' ? 'approved' : 'rejected',
      notes: notes,
      processed_at: new Date(),
      updated_at: new Date()
    }, { transaction: t });

    // Update withdrawal record based on admin action
    if (action === 'approve') {
      // Determine which gateway to use
      const gateway = withdrawal.payment_gateway;

      // Update withdrawal status to approved
      await withdrawal.update({
        admin_status: 'approved',
        remark: `Admin approved. Processing via ${gateway}.`
      }, { transaction: t });

      await t.commit();

      // After committing the DB transaction, process the actual transfer
      // based on the selected gateway
      let transferResult;

      // Get host for callback URL
      const host = process.env.API_BASE_URL || 'http://localhost:8000';
      let notifyUrl = '';

      // Set the appropriate callback URL based on gateway
      switch (gateway) {
        case 'WEPAY':
          notifyUrl = `${host}/api/payments/wepay/payout-callback`;
          transferResult = await processWePayTransfer(withdrawalId, notifyUrl);
          break;
        case 'MXPAY':
          notifyUrl = `${host}/api/payments/mxpay/transfer-callback`;
          transferResult = await processMxPayTransfer(withdrawalId, notifyUrl);
          break;
        default: // OKPAY or any other
          notifyUrl = `${host}/api/payments/okpay/payout-callback`;
          transferResult = await processOkPayTransfer(withdrawalId, notifyUrl);
          break;
      }

      return transferResult;
    } else {
      // Rejection - refund the user's wallet
      const user = await User.findByPk(withdrawal.user_id, {
        transaction: t
      });

      if (!user) {
        await t.rollback();
        return {
          success: false,
          message: "User not found for refund"
        };
      }

      // Update user wallet balance (refund)
      const newBalance = parseFloat(user.wallet_balance) + parseFloat(withdrawal.withdrawal_amount);
      await User.update(
        { wallet_balance: newBalance },
        {
          where: { user_id: withdrawal.user_id },
          transaction: t
        }
      );

      // Update withdrawal status
      await withdrawal.update({
        admin_status: 'rejected',
        remark: `Admin rejected. Reason: ${notes}. Amount refunded to wallet.`,
        time_of_failed: new Date()
      }, { transaction: t });

      await t.commit();

      return {
        success: true,
        message: "Withdrawal rejected and amount refunded to user's wallet"
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Error processing admin action:", error);

    return {
      success: false,
      message: "Failed to process admin action"
    };
  }
};

// Controller to initiate a withdrawal request with OTP verification
const initiateWithdrawalController = async (req, res) => {
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

    const result = await initiateWithdrawal(userId, bank_account_id, amount, withdrawal_type, gateway);

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

const verifyWithdrawalOtpController = async (req, res) => {
  try {
    const { otp_session_id, gateway = 'OKPAY' } = req.body;
    const userId = req.user.user_id;

    if (!otp_session_id) {
      return res.status(400).json({
        success: false,
        message: 'OTP session ID is required'
      });
    }

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

const payInCallbackController = async (req, res) => {
  try {
    const result = await processPayInCallback(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing pay-in callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing pay-in callback'
    });
  }
};

const payOutCallbackController = async (req, res) => {
  try {
    const result = await processPayOutCallback(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing pay-out callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing pay-out callback'
    });
  }
};

const wePayCollectionCallbackController = async (req, res) => {
  try {
    const result = await processWePayCollectionCallback(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing WePay collection callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing WePay collection callback'
    });
  }
};

const wePayTransferCallbackController = async (req, res) => {
  try {
    const result = await processWePayTransferCallback(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing WePay transfer callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing WePay transfer callback'
    });
  }
};

const getPaymentStatusController = async (req, res) => {
  try {
    const { order_id } = req.params;
    const result = await getPaymentStatus(order_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error getting payment status'
    });
  }
};

module.exports = {
  payInController,
  processWithdrawalAdminAction,
  initiateWithdrawalController,
  verifyWithdrawalOtpController,
  payInCallbackController,
  payOutCallbackController,
  wePayCollectionCallbackController,
  wePayTransferCallbackController,
  getPaymentStatusController
};