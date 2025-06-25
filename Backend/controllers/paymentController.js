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

// Import the new MxPay service
const { createMxPayCollectionOrder } = require('../services/mxPayService');

const { autoProcessRechargeForAttendance } = require('../services/referralService');

// Import the new OKPAY service
const { 
  createOkPayCollectionOrder,
  processOkPayCallback 
} = require('../services/okPayService');

// Import the new GH Pay service
const { 
  createGhPayDepositOrder,
  processGhPayWithdrawal,
  processGhPayCallback
} = require('../services/ghPayService');

// Import the new WOWPAY service
const {
  createWowPayDepositOrder,
  processWowPayDepositCallback,
  createWowPayWithdrawalOrder,
  processWowPayWithdrawalCallback
} = require('../services/wowPayService');

// Import the new PPAYPRO service
const {
  createPpayProDepositOrder,
  processPpayProDepositCallback,
  createPpayProWithdrawalOrder,
  processPpayProWithdrawalCallback
} = require('../services/ppayProService');

// Import the new SOLPAY service
const {
  createSolPayDepositOrder,
  processSolPayDepositCallback,
  createSolPayWithdrawalOrder,
  processSolPayWithdrawalCallback
} = require('../services/solPayService');

// Import the new LPay service
const {
  createLPayCollectionOrder,
  processLPayCollectionCallback,
  createLPayTransferOrder,
  processLPayWithdrawalCallback
} = require('../services/lPayService');

// Import PaymentGateway model
const PaymentGateway = require('../models/PaymentGateway');
const User = require('../models/User');
const { sequelize } = require('../config/db');
const WithdrawalAdmin = require('../models/WithdrawalAdmin');
const WalletWithdrawal = require('../models/WalletWithdrawal');

// Controller to handle payment creation (adding money to wallet) with gateway selection
// Updated section for paymentController.js to include MxPay

// Update the payInController to support PPAYPRO
const payInController = async (req, res) => {
  try {
    const { amount, pay_type = 'UPI', gateway = 'OKPAY', paymentType, channel, feeType, ...optionalFields } = req.body;
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
      case 'OKPAY':
        notifyUrl = `${host}/api/payments/okpay/payin-callback`;
        break;
      case 'GHPAY':
        notifyUrl = `${host}/api/payments/ghpay/payin-callback`;
        break;
      case 'WOWPAY':
        notifyUrl = `${host}/api/payments/wowpay/payin-callback`;
        break;
      case 'PPAYPRO':
        notifyUrl = `${host}/api/payments/ppaypro/payin-callback`;
        break;
      case 'SOLPAY':
        notifyUrl = `${host}/api/payments/solpay/payin-callback`;
        break;
      case 'LPAY':
        result = await createLPayCollectionOrder(
          userId,
          orderId,
          amount,
          notifyUrl,
          paymentGateway.gateway_id // or returnUrl if needed
        );
        break;
      default:
        notifyUrl = `${host}/api/payments/okpay/payin-callback`;
        break;
    }

    console.log(`Creating payment with gateway: ${gateway}, amount: ${amount}, notifyUrl: ${notifyUrl}`);

    let result;

    // Choose the appropriate payment gateway
    switch (gateway) {
      case 'WEPAY':
        result = await createWePayCollectionOrder(userId, orderId, amount, notifyUrl, returnUrl, paymentGateway.gateway_id);
        break;
      case 'MXPAY':
        result = await createMxPayCollectionOrder(userId, orderId, amount, notifyUrl, returnUrl, paymentGateway.gateway_id);
        break;
      case 'OKPAY':
        result = await createOkPayCollectionOrder(userId, orderId, pay_type, amount, notifyUrl, paymentGateway.gateway_id);
        break;
      case 'GHPAY':
        result = await createGhPayDepositOrder(
          userId,
          orderId,
          {
            paymentType: paymentType || '1001',
            gold: amount,
            channel: channel || 0,
            feeType: feeType || 0,
            optionalFields
          },
          notifyUrl,
          paymentGateway.gateway_id
        );
        break;
      case 'WOWPAY':
        result = await createWowPayDepositOrder(
          userId,
          orderId,
          {
            amount: amount.toFixed(2),
            ...optionalFields
          },
          notifyUrl,
          paymentGateway.gateway_id
        );
        break;
      case 'PPAYPRO':
        result = await createPpayProDepositOrder(
          userId,
          orderId,
          {
            amount: parseInt(amount, 10), // PPAYPRO expects integer (smallest unit)
            ...optionalFields
          },
          notifyUrl,
          paymentGateway.gateway_id
        );
        break;
      case 'SOLPAY':
        result = await createSolPayDepositOrder(
          userId,
          orderId,
          {
            amount: amount.toFixed(2),
            ...optionalFields
          },
          notifyUrl,
          paymentGateway.gateway_id
        );
        break;
      case 'LPAY':
        result = await createLPayCollectionOrder(
          userId,
          orderId,
          amount,
          notifyUrl,
          paymentGateway.gateway_id // or returnUrl if needed
        );
        break;
      default:
        result = await createOkPayCollectionOrder(userId, orderId, pay_type, amount, notifyUrl, paymentGateway.gateway_id);
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

// Update the processWithdrawalAdminAction function to support PPAYPRO
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
        case 'GHPAY':
          notifyUrl = `${host}/api/payments/ghpay/payout-callback`;
          transferResult = await processGhPayWithdrawal(withdrawalId, notifyUrl);
          break;
        case 'WOWPAY':
          notifyUrl = `${host}/api/payments/wowpay/payout-callback`;
          transferResult = await createWowPayWithdrawalOrder(
            withdrawal.user_id,
            withdrawal.order_id,
            {
              amount: withdrawal.amount.toFixed(2),
              trade_account: withdrawal.account_holder,
              trade_number: withdrawal.account_number,
              // Add more fields as needed from withdrawal/bank account
            },
            notifyUrl,
            withdrawal.payment_gateway_id
          );
          break;
        case 'PPAYPRO':
          notifyUrl = `${host}/api/payments/ppaypro/payout-callback`;
          transferResult = await createPpayProWithdrawalOrder(
            withdrawal.user_id,
            withdrawal.order_id,
            {
              amount: parseInt(withdrawal.amount, 10),
              entryType: withdrawal.withdrawal_type, // e.g., 'IMPS', 'UPI', etc.
              accountNo: withdrawal.account_number,
              accountCode: withdrawal.ifsc_code, // or other code as needed
              accountName: withdrawal.account_holder,
              accountEmail: withdrawal.account_email,
              accountPhone: withdrawal.account_phone,
              // Add more fields as needed from withdrawal/bank account
            },
            notifyUrl,
            withdrawal.payment_gateway_id
          );
          break;
        case 'SOLPAY':
          notifyUrl = `${host}/api/payments/solpay/payout-callback`;
          transferResult = await createSolPayWithdrawalOrder(
            withdrawal.user_id,
            withdrawal.order_id,
            {
              amount: withdrawal.amount,
              name: withdrawal.account_holder,
              bankName: withdrawal.bank_name,
              bankAccount: withdrawal.account_number,
              ifscCode: withdrawal.ifsc_code,
              email: withdrawal.account_email,
              phone: withdrawal.account_phone,
              feeType: withdrawal.fee_type || '0',
              description: withdrawal.remark || 'Withdrawal'
            },
            notifyUrl,
            withdrawal.payment_gateway_id
          );
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
    
    // FIXED: Handle attendance processing after successful recharge/deposit callback
    if (result.success && result.userId && result.amount) {
      try {
        const attendanceResult = await autoProcessRechargeForAttendance(result.userId, result.amount);
        console.log('Attendance processed for recharge:', attendanceResult);
      } catch (attendanceError) {
        console.error('Failed to process attendance for recharge:', attendanceError.message);
        // Don't fail the callback if attendance processing fails
      }
    }
    
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

// Add OKPAY-specific callback handler
const okPayCallbackController = async (req, res) => {
  try {
    console.log('OKPAY Callback Received:', req.body);
    const result = await processOkPayCallback(req.body);
    
    // FIXED: Handle attendance processing after successful payment callback
    if (result.success && result.userId && result.amount) {
      try {
        const attendanceResult = await autoProcessRechargeForAttendance(result.userId, result.amount);
        console.log('Attendance processed for recharge:', attendanceResult);
      } catch (attendanceError) {
        console.error('Failed to process attendance for recharge:', attendanceError.message);
        // Don't fail the callback if attendance processing fails
      }
    }
    
    if (result.success) {
      // OKPAY requires the string "success" as response
      return res.status(200).send('success');
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error processing OKPAY callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing OKPAY callback'
    });
  }
};

// Add GH Pay-specific callback handler
const ghPayCallbackController = async (req, res) => {
  try {
    console.log('GHPAY Callback Received:', req.body);
    const result = await processGhPayCallback(req.body);
    if (result.success) {
      return res.status(200).send('success');
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error processing GHPAY callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing GHPAY callback'
    });
  }
};

// Controller to handle deposit initiation
const initiateDeposit = async (req, res) => {
    try {
        const { amount, payment_method, currency = 'INR' } = req.body;
        const userId = req.user.user_id;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount provided'
            });
        }

        // Create a unique order ID
        const orderId = `DEP${Date.now()}${userId}`;

        // Get host for callback URL
        const host = `${req.protocol}://${req.get('host')}`;
        let notifyUrl = '';
        
        // Set the callback URL based on payment method
        switch (payment_method) {
            case 'WEPAY':
                notifyUrl = `${host}/api/payments/wepay/payin-callback`;
                break;
            case 'MXPAY':
                notifyUrl = `${host}/api/payments/mxpay/collection-callback`;
                break;
            case 'OKPAY':
                notifyUrl = `${host}/api/payments/okpay/payin-callback`;
                break;
            default:
                notifyUrl = `${host}/api/payments/deposit-callback`;
                break;
        }
        
        const returnUrl = `${process.env.FRONTEND_URL}/wallet`;

        // Find the payment gateway based on payment method
        const paymentGateway = await PaymentGateway.findOne({
            where: { 
                code: payment_method,
                is_active: true 
            }
        });

        if (!paymentGateway) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or inactive payment method'
            });
        }

        // Create deposit order based on payment method
        let result;
        switch (payment_method) {
            case 'WEPAY':
                result = await createWePayCollectionOrder(userId, orderId, amount, notifyUrl, returnUrl, paymentGateway.gateway_id);
                break;
            case 'MXPAY':
                result = await createMxPayCollectionOrder(userId, orderId, amount, notifyUrl, returnUrl, paymentGateway.gateway_id);
                break;
            case 'OKPAY':
                result = await createOkPayCollectionOrder(userId, orderId, 'UPI', amount, notifyUrl, paymentGateway.gateway_id);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Unsupported payment method'
                });
        }

        if (result.success) {
            // FIXED: Handle attendance processing after successful deposit initiation
            try {
                const attendanceResult = await autoProcessRechargeForAttendance(userId, parseFloat(amount));
                console.log('Attendance processed for deposit:', attendanceResult);
            } catch (attendanceError) {
                console.error('Failed to process attendance for deposit:', attendanceError.message);
                // Don't fail the deposit if attendance processing fails
            }
            
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error initiating deposit:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error initiating deposit'
        });
    }
};

// Controller to get deposit history
const getDepositHistory = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = { user_id: userId };
        if (status) {
            whereClause.status = status;
        }

        // Get deposits with pagination
        const deposits = await sequelize.query(`
            SELECT 
                d.*,
                pg.name as gateway_name,
                pg.code as gateway_code
            FROM deposits d
            LEFT JOIN payment_gateways pg ON d.gateway_id = pg.gateway_id
            WHERE d.user_id = :userId
            ${status ? 'AND d.status = :status' : ''}
            ORDER BY d.created_at DESC
            LIMIT :limit OFFSET :offset
        `, {
            replacements: {
                userId,
                status,
                limit: parseInt(limit),
                offset: parseInt(offset)
            },
            type: sequelize.QueryTypes.SELECT
        });

        // Get total count
        const totalCount = await sequelize.query(`
            SELECT COUNT(*) as count
            FROM deposits
            WHERE user_id = :userId
            ${status ? 'AND status = :status' : ''}
        `, {
            replacements: {
                userId,
                status
            },
            type: sequelize.QueryTypes.SELECT
        });

        return res.status(200).json({
            success: true,
            data: {
                deposits,
                pagination: {
                    total: totalCount[0].count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount[0].count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting deposit history:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting deposit history'
        });
    }
};

// Controller to get withdrawal history
const getWithdrawalHistory = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = { user_id: userId };
        if (status) {
            whereClause.status = status;
        }

        // Get withdrawals with pagination
        const withdrawals = await sequelize.query(`
            SELECT 
                w.*,
                pg.name as gateway_name,
                pg.code as gateway_code,
                ba.account_number,
                ba.ifsc_code,
                ba.bank_name,
                ba.account_holder_name
            FROM wallet_withdrawals w
            LEFT JOIN payment_gateways pg ON w.payment_gateway = pg.code
            LEFT JOIN bank_accounts ba ON w.bank_account_id = ba.id
            WHERE w.user_id = :userId
            ${status ? 'AND w.status = :status' : ''}
            ORDER BY w.created_at DESC
            LIMIT :limit OFFSET :offset
        `, {
            replacements: {
                userId,
                status,
                limit: parseInt(limit),
                offset: parseInt(offset)
            },
            type: sequelize.QueryTypes.SELECT
        });

        // Get total count
        const totalCount = await sequelize.query(`
            SELECT COUNT(*) as count
            FROM wallet_withdrawals
            WHERE user_id = :userId
            ${status ? 'AND status = :status' : ''}
        `, {
            replacements: {
                userId,
                status
            },
            type: sequelize.QueryTypes.SELECT
        });

        return res.status(200).json({
            success: true,
            data: {
                withdrawals,
                pagination: {
                    total: totalCount[0].count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount[0].count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting withdrawal history:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error getting withdrawal history'
        });
    }
};

// Add WOWPAY withdrawal callback handler
const wowPayWithdrawalCallbackController = async (req, res) => {
  try {
    console.log('WOWPAY Withdrawal Callback Received:', req.body);
    const result = await processWowPayWithdrawalCallback(req.body);
    if (result.success) {
      return res.status(200).send('success');
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error processing WOWPAY withdrawal callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing WOWPAY withdrawal callback'
    });
  }
};

// Add PPAYPRO deposit callback handler
const ppayProDepositCallbackController = async (req, res) => {
  try {
    console.log('PPayPro Deposit Callback Received:', req.body);
    const result = await processPpayProDepositCallback(req.body);
    if (result.success) {
      return res.status(200).send('success');
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error processing PPayPro deposit callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing PPayPro deposit callback'
    });
  }
};

// Add PPAYPRO withdrawal callback handler
const ppayProWithdrawalCallbackController = async (req, res) => {
  try {
    console.log('PPayPro Withdrawal Callback Received:', req.body);
    const result = await processPpayProWithdrawalCallback(req.body);
    if (result.success) {
      return res.status(200).send('success');
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error processing PPayPro withdrawal callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing PPayPro withdrawal callback'
    });
  }
};

// Add SOLPAY deposit callback handler
const solPayDepositCallbackController = async (req, res) => {
  try {
    console.log('SOLPAY Deposit Callback Received:', req.body);
    const result = await processSolPayDepositCallback(req.body);
    if (result.success) {
      return res.status(200).send('SUCCESS');
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error processing SOLPAY deposit callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing SOLPAY deposit callback'
    });
  }
};

// Add SOLPAY withdrawal callback handler
const solPayWithdrawalCallbackController = async (req, res) => {
  try {
    console.log('SOLPAY Withdrawal Callback Received:', req.body);
    const result = await processSolPayWithdrawalCallback(req.body);
    if (result.success) {
      return res.status(200).send('SUCCESS');
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error processing SOLPAY withdrawal callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing SOLPAY withdrawal callback'
    });
  }
};

// Add WOWPAY deposit callback handler
const wowPayDepositCallbackController = async (req, res) => {
  try {
    console.log('WOWPAY Deposit Callback Received:', req.body);
    const result = await processWowPayDepositCallback(req.body);
    if (result.success) {
      return res.status(200).send('success');
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error processing WOWPAY deposit callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing WOWPAY deposit callback'
    });
  }
};

// Add LPay deposit callback controller
const lPayDepositCallbackController = async (req, res) => {
  try {
    const result = await processLPayCollectionCallback(req.body);
    if (result.success) {
      return res.status(200).send('ok');
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Add LPay withdrawal callback controller
const lPayWithdrawalCallbackController = async (req, res) => {
  try {
    const result = await processLPayWithdrawalCallback(req.body);
    if (result.success) {
      return res.status(200).send('ok');
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
  getPaymentStatusController,
  okPayCallbackController,
  ghPayCallbackController,
  initiateDeposit,
  getDepositHistory,
  getWithdrawalHistory,
  wowPayWithdrawalCallbackController,
  ppayProDepositCallbackController,
  ppayProWithdrawalCallbackController,
  solPayDepositCallbackController,
  solPayWithdrawalCallbackController,
  wowPayDepositCallbackController,
  lPayDepositCallbackController,
  lPayWithdrawalCallbackController,
};