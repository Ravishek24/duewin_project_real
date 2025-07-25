const axios = require('axios');
const { sequelize } = require('../config/db');
const paymentConfig = require('../config/paymentConfig');
const { generateSignature } = require('../utils/generateSignature');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const BankAccount = require('../models/BankAccount');
const WithdrawalAdmin = require('../models/WithdrawalAdmin');
const referralService = require('./referralService');
const otpService = require('./otpService');
const { processWePayTransfer } = require('./wePayService');
const { processMxPayTransfer } = require('./mxPayService');
const { createPpayProWithdrawalOrder } = require('./ppayProService');
const { createLPayTransferOrder } = require('./lPayService'); // <-- Add this import
const { Op } = require('sequelize');
const Transaction = require('../models/Transaction'); // Added this import for processRechargeAdminAction
const SpribeTransaction = require('../models/SpribeTransaction');
const SeamlessTransaction = require('../models/SeamlessTransaction');
const AttendanceRecord = require('../models/AttendanceRecord');
const moment = require('moment-timezone');

/**
 * Creates a PayIn order (deposit)
 * @param {number} userId - User ID
 * @param {string} orderId - Unique order number
 * @param {string} payType - Payment method (UPI)
 * @param {number} amount - Amount (Integer)
 * @param {string} notifyUrl - Callback URL for notifications
 * @returns {Object} - API response
 */
const createPayInOrder = async (userId, orderId, payType, amount, notifyUrl) => {
  const t = await sequelize.transaction();
  
  try {
    // Get user info
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      await t.rollback();
      return {
        success: false, 
        message: "User not found"
      };
    }
    
    // Create recharge record
    await WalletRecharge.create({
      user_id: userId,
      phone_no: user.phone_no,
      amount: amount,
      order_id: orderId,
      payment_gateway: 'OKPAY',
      status: false
    }, { transaction: t });
    
    // Prepare request data
    const requestData = {
      mchId: paymentConfig.mchId,
      currency: "INR",
      out_trade_no: orderId,
      pay_type: payType,
      money: parseInt(amount), // Must be integer
      attach: `Wallet recharge for user ${userId}`,
      notify_url: notifyUrl,
      returnUrl: process.env.FRONTEND_URL || "https://www.yourdomain.com/wallet",
    };

    // Generate the signature
    requestData.sign = generateSignature(requestData);

    // Call the payment gateway API
    const response = await axios.post(`${paymentConfig.host}/v1/Collect`, requestData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    
    // Check API response
    if (response.data.code === 0) {
      // Update recharge record with transaction ID
      await WalletRecharge.update(
        { transaction_id: response.data.data.transaction_Id },
        { 
          where: { order_id: orderId },
          transaction: t 
        }
      );
      
      await t.commit();
      
      return {
        success: true,
        message: "Payment order created successfully",
        paymentUrl: response.data.data.url,
        transactionId: response.data.data.transaction_Id,
        orderId: orderId
      };
    } else {
      await t.rollback();
      
      return {
        success: false,
        message: `Payment gateway error: ${response.data.msg}`,
        errorCode: response.data.code
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Error creating PayIn order:", error.message);
    
    return {
      success: false,
      message: "Failed to create payment order"
    };
  }
};

/**
 * Initial step for withdrawal - create a withdrawal request
 * @param {number} userId - User ID
 * @param {number} bankAccountId - Bank account ID
 * @param {number} amount - Withdrawal amount
 * @param {string} withdrawalType - BANK or UPI
 * @returns {Object} - Response with withdrawal details
 */
const initiateWithdrawal = async (userId, bankAccountId, amount, withdrawalType = 'BANK') => {
  const t = await sequelize.transaction();
  
  try {
    // Get user
    const user = await User.findByPk(userId, {
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        success: false,
        message: "User not found"
      };
    }
    
    // Check wallet balance
    if (parseFloat(user.wallet_balance) < parseFloat(amount)) {
      await t.rollback();
      return {
        success: false,
        message: "Insufficient wallet balance"
      };
    }
    
    // Get bank account details
    const bankAccount = await BankAccount.findOne({
      where: {
        bank_account_id: bankAccountId,
        user_id: userId
      },
      transaction: t
    });
    
    if (!bankAccount) {
      await t.rollback();
      return {
        success: false,
        message: "Bank account not found"
      };
    }
    
    // Create order ID
    const orderId = `WD${Date.now()}${userId}`;
    
    // Create withdrawal record
    const withdrawal = await WalletWithdrawal.create({
      user_id: userId,
      amount: amount,
      status: 'pending',
      payment_gateway_id: 1, // Default gateway ID
      withdrawal_type: withdrawalType,
      order_id: orderId, // Always set order_id
      transaction_id: orderId, // Set transaction_id to orderId initially
      bank_account_id: bankAccountId
    }, { transaction: t });
    
    // Create admin approval record
    await WithdrawalAdmin.create({
      withdrawal_id: withdrawal.id,
      status: 'pending',
      notes: `Withdrawal request initiated by user. Amount: ${amount} INR.`
    }, { transaction: t });
    
    // Deduct amount from wallet
    const newBalance = parseFloat(user.wallet_balance) - parseFloat(amount);
    await User.update(
      { wallet_balance: newBalance },
      { where: { user_id: userId }, transaction: t }
    );
    
    await t.commit();
    
    return {
      success: true,
      message: "Withdrawal request submitted successfully. Awaiting admin approval.",
      withdrawal: {
        id: withdrawal.id,
        amount,
        status: 'pending',
        created_at: withdrawal.created_at
      }
    };
  } catch (error) {
    await t.rollback();
    console.error("Error initiating withdrawal:", error);
    
    return {
      success: false,
      message: "Failed to initiate withdrawal"
    };
  }
};

/**
 * Process admin approval/rejection for a withdrawal
 * @param {number} adminId - Admin user ID
 * @param {number} withdrawalId - Withdrawal ID
 * @param {string} action - 'approve' or 'reject'
 * @param {string} notes - Admin notes or rejection reason
 * @returns {Object} - Processing result
 */
const processWithdrawalAdminAction = async (adminId, withdrawalId, action, notes = '', selectedGateway = null) => {
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
    if (withdrawal.status !== 'pending') {
      await t.rollback();
      return {
        success: false,
        message: `This withdrawal has already been ${withdrawal.status}`
      };
    }
    
    // OTP verification is not required in current implementation
    // if (!withdrawal.otp_verified) {
    //   await t.rollback();
    //   return {
    //     success: false,
    //     message: "This withdrawal has not been verified by the user yet"
    //   };
    // }
    
    // Get the admin record
    let adminRecord = await WithdrawalAdmin.findOne({
      where: { withdrawal_id: withdrawalId },
      transaction: t
    });
    
    if (!adminRecord) {
      // If no admin record exists, create one now
      adminRecord = await WithdrawalAdmin.create({
        withdrawal_id: withdrawalId,
        admin_id: adminId,
        status: 'pending',
        notes: '',
        created_at: new Date(),
        updated_at: new Date(),
        processed_at: null
      }, { transaction: t });
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
      // Use the selected gateway
      const gatewayCode = selectedGateway || 'OKPAY'; // Default to OKPAY
      // Find the gateway record
      const PaymentGateway = require('../models/PaymentGateway');
      const gatewayRecord = await PaymentGateway.findOne({ where: { code: gatewayCode } });
      if (!gatewayRecord) {
        await t.rollback();
        return {
          success: false,
          message: 'Selected payment gateway not found.'
        };
      }
      // Update withdrawal with correct gateway and gateway_id
      await withdrawal.update({
        status: 'approved',
        payment_gateway_id: gatewayRecord.gateway_id
      }, { transaction: t });
      
      // Commit the transaction first to avoid nested transaction issues
      await t.commit();
      
      // After committing, process the actual transfer (outside of transaction)
      let transferResult;
      const host = process.env.API_BASE_URL || 'http://localhost:8000';
      let notifyUrl = '';
      switch (gatewayCode) {
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
            gatewayRecord.gateway_id
          );
          break;
        case 'PPAYPRO':
          notifyUrl = `${host}/api/payments/ppaypro/payout-callback`;
          // Fetch bank account details like OKPAY
          let ppayproBankAccount;
          if (withdrawal.bank_account_id) {
            ppayproBankAccount = await BankAccount.findOne({
              where: {
                id: withdrawal.bank_account_id,
                user_id: withdrawal.user_id
              }
            });
          } else {
            ppayproBankAccount = await BankAccount.findOne({
              where: {
                user_id: withdrawal.user_id,
                is_primary: true
              }
            });
          }
          if (!ppayproBankAccount) {
            throw new Error('Bank account not found for withdrawal');
          }
          let accountEmail = ppayproBankAccount.account_email;
          let accountPhone = ppayproBankAccount.account_phone;
          if (!accountEmail) {
            accountEmail = 'user@example.com';
          }
          if (!accountPhone) {
            accountPhone = '9999999999';
          }
          const ppayproPayload = {
            amount: parseInt(withdrawal.amount, 10),
            entryType: withdrawal.withdrawal_type, // e.g., 'IMPS', 'UPI', etc.
            accountNo: ppayproBankAccount.account_number,
            accountCode: ppayproBankAccount.ifsc_code,
            accountName: ppayproBankAccount.account_holder,
            accountEmail: accountEmail,
            accountPhone: accountPhone,
            // Add more fields as needed from bank account
          };
          console.log('[PPAYPRO][Withdrawal] Payload:', ppayproPayload);
          transferResult = await createPpayProWithdrawalOrder(
            withdrawal.user_id,
            withdrawal.order_id,
            ppayproPayload,
            notifyUrl,
            gatewayRecord.gateway_id
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
            gatewayRecord.gateway_id
          );
          break;
        case '101PAY':
          notifyUrl = `${host}/api/payments/101pay/payout-callback`;
          // Use the provided withdrawal type as channel code, fallback to 'bank' if not provided
          let withdrawalChannelCode = withdrawal.withdrawal_type || 'bank';
          transferResult = await create101PayWithdrawalOrder({
            merchantOrderNo: withdrawal.order_id,
            beneficiary: withdrawal.account_holder,
            bankName: withdrawal.bank_name,
            bankAccount: withdrawal.account_number,
            ifsc: withdrawal.ifsc_code,
            currency: 'inr',
            channelCode: withdrawalChannelCode,
            amount: withdrawal.amount,
            address: withdrawal.remark || 'Withdrawal',
            notifyUrl
          });
          break;
        case 'LPAY':
          notifyUrl = `${host}/api/payments/lpay/withdrawal-callback`;
          // Fetch bank account details
          let lpayBankAccount;
          if (withdrawal.bank_account_id) {
            lpayBankAccount = await BankAccount.findOne({
              where: {
                id: withdrawal.bank_account_id,
                user_id: withdrawal.user_id
              }
            });
          } else {
            lpayBankAccount = await BankAccount.findOne({
              where: {
                user_id: withdrawal.user_id,
                is_primary: true
              }
            });
          }
          if (!lpayBankAccount) {
            throw new Error('Bank account not found for withdrawal');
          }
          const lpayBankDetails = {
            accountNo: lpayBankAccount.account_number,
            accountName: lpayBankAccount.account_holder,
            bankCode: lpayBankAccount.ifsc_code,
            phone: lpayBankAccount.account_phone || '',
            ifsc: lpayBankAccount.ifsc_code
          };
          transferResult = await createLPayTransferOrder(
            withdrawal.user_id,
            withdrawal.order_id,
            withdrawal.amount,
            lpayBankDetails,
            notifyUrl
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
      const newBalance = parseFloat(user.wallet_balance) + parseFloat(withdrawal.amount);
      await User.update(
        { wallet_balance: newBalance },
        { 
          where: { user_id: withdrawal.user_id },
          transaction: t 
        }
      );
      
      // Update withdrawal status
      await withdrawal.update({
        status: 'rejected'
      }, { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        message: "Withdrawal rejected and amount refunded to user's wallet"
      };
    }
  } catch (error) {
    // Only rollback if transaction is still active
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error("Error processing admin action:", error);
    
    return {
      success: false,
      message: "Failed to process admin action"
    };
  }
};

/**
 * Process admin approval/rejection for a deposit/recharge
 * @param {number} adminId - Admin user ID
 * @param {number} rechargeId - Recharge ID
 * @param {string} action - 'approve' or 'reject'
 * @param {string} notes - Admin notes or rejection reason
 * @returns {Object} - Processing result
 */
const processRechargeAdminAction = async (adminId, rechargeId, action, notes = '') => {
  const t = await sequelize.transaction();
  
  try {
    // Get recharge
    const recharge = await WalletRecharge.findByPk(rechargeId, {
      transaction: t
    });
    
    if (!recharge) {
      await t.rollback();
      return {
        success: false,
        message: "Recharge not found"
      };
    }
    
    // Check if recharge can be processed
    if (recharge.status !== 'pending') {
      await t.rollback();
      return {
        success: false,
        message: `This recharge has already been ${recharge.status}`
      };
    }
    
    // Get the user
    const user = await User.findByPk(recharge.user_id, {
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        success: false,
        message: "User not found"
      };
    }
    
    // Process based on admin action
    if (action === 'approve') {
      // Calculate bonus amount if this is first deposit
      let bonusAmount = 0;
      const isFirstDeposit = parseFloat(user.actual_deposit_amount) === 0;
      const isEligibleForFirstBonus = isFirstDeposit && !user.has_received_first_bonus;
      
      if (isEligibleForFirstBonus) {
        // Define bonus tiers
        const bonusTiers = [
          { amount: 100, bonus: 20 },
          { amount: 300, bonus: 60 },
          { amount: 1000, bonus: 150 },
          { amount: 3000, bonus: 300 },
          { amount: 10000, bonus: 600 },
          { amount: 30000, bonus: 2000 },
          { amount: 100000, bonus: 7000 },
          { amount: 200000, bonus: 15000 }
        ];

        // Find applicable bonus tier
        for (let i = bonusTiers.length - 1; i >= 0; i--) {
          if (parseFloat(recharge.amount) >= bonusTiers[i].amount) {
            bonusAmount = bonusTiers[i].bonus;
            break;
          }
        }
      }
      
      // Update recharge status
      await recharge.update({
        status: 'completed',
        bonus_amount: bonusAmount,
        updated_at: new Date()
      }, { transaction: t });
      
      // Update user wallet balance
      const depositAmount = parseFloat(recharge.amount);
      const totalAmount = depositAmount + bonusAmount;
      const newBalance = parseFloat(user.wallet_balance) + totalAmount;
      
      await user.update({
        wallet_balance: newBalance,
        actual_deposit_amount: parseFloat(user.actual_deposit_amount) + depositAmount,
        has_received_first_bonus: isEligibleForFirstBonus ? true : user.has_received_first_bonus,
        updated_at: new Date()
      }, { transaction: t });
      
      // Create transaction record
      await Transaction.create({
        user_id: recharge.user_id,
        type: 'deposit',
        amount: totalAmount,
        status: 'completed',
        description: `Deposit approved by admin - ${notes}`,
        reference_id: recharge.order_id,
        metadata: {
          recharge_id: recharge.id,
          deposit_amount: depositAmount,
          bonus_amount: bonusAmount,
          admin_approved: true
        }
      }, { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        message: "Deposit approved and wallet credited",
        data: {
          rechargeId: recharge.id,
          depositAmount: depositAmount,
          bonusAmount: bonusAmount,
          totalAmount: totalAmount,
          newBalance: newBalance
        }
      };
      
    } else if (action === 'reject') {
      // Update recharge status to failed
      await recharge.update({
        status: 'failed',
        updated_at: new Date()
      }, { transaction: t });
      
      // Create transaction record for rejected deposit
      await Transaction.create({
        user_id: recharge.user_id,
        type: 'deposit_rejected',
        amount: 0,
        status: 'failed',
        description: `Deposit rejected by admin - ${notes}`,
        reference_id: recharge.order_id,
        metadata: {
          recharge_id: recharge.id,
          admin_rejected: true,
          rejection_reason: notes
        }
      }, { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        message: "Deposit rejected",
        data: {
          rechargeId: recharge.id,
          rejectionReason: notes
        }
      };
    }
    
  } catch (error) {
    await t.rollback();
    console.error("Error processing recharge admin action:", error);
    
    return {
      success: false,
      message: "Failed to process admin action"
    };
  }
};

/**
 * Process a transfer via OKPAY after admin approval
 * @param {number} withdrawalId - Withdrawal ID
 * @param {string} notifyUrl - Notification URL for callbacks
 * @returns {Object} - Processing result
 */
const processOkPayTransfer = async (withdrawalId, notifyUrl) => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    const t = await sequelize.transaction();
    
    try {
      // Get withdrawal with lock to prevent concurrent updates
      const withdrawal = await WalletWithdrawal.findByPk(withdrawalId, {
        lock: true,
        transaction: t
      });
      
      if (!withdrawal) {
        await t.rollback();
        return {
          success: false,
          message: "Withdrawal not found"
        };
      }
      
      // Check if withdrawal is already processed
      if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
        await t.rollback();
        return {
          success: false,
          message: "Withdrawal already processed"
        };
      }
      
      // Get bank account details
      console.log('[DEBUG] Looking for bank account:', withdrawal.bank_account_id, withdrawal.user_id);
      let bankAccount;
      if (withdrawal.bank_account_id) {
        bankAccount = await BankAccount.findOne({
          where: {
            id: withdrawal.bank_account_id,
            user_id: withdrawal.user_id
          },
          transaction: t
        });
        console.log('[DEBUG] Bank account found:', bankAccount);
      } else {
        bankAccount = await BankAccount.findOne({
          where: {
            user_id: withdrawal.user_id,
            is_primary: true
          },
          transaction: t
        });
        console.log('[DEBUG] Fallback to primary bank account:', bankAccount);
      }
      
      if (!bankAccount) {
        await t.rollback();
        return {
          success: false,
          message: "Bank account not found for withdrawal"
        };
      }
      
      // Prepare request data for payment gateway
      const requestData = {
        mchId: paymentConfig.mchId,
        currency: "INR",
        out_trade_no: withdrawal.transaction_id,
        pay_type: withdrawal.withdrawal_type, // BANK or UPI
        account: bankAccount.account_number,
        userName: bankAccount.account_holder,
        money: parseInt(withdrawal.amount), // Must be integer
        attach: "Withdrawal for user " + withdrawal.user_id,
        notify_url: notifyUrl,
        reserve1: withdrawal.withdrawal_type === 'BANK' ? bankAccount.ifsc_code : '' // IFSC for BANK type
      };
      
      // Log all request data for callback testing
      console.log('[OKPAY][Withdrawal] Request Data:', JSON.stringify(requestData, null, 2));

      // Log the string to be signed and the generated signature
      const signatureString = (() => {
        const qs = require('querystring');
        const params = Object.keys(requestData)
          .filter((key) => key !== 'sign' && requestData[key] !== '' && requestData[key] !== undefined)
          .sort()
          .reduce((acc, key) => {
            acc[key] = requestData[key];
            return acc;
          }, {});
        const queryString = qs.stringify(params);
        return `${queryString}&key=${paymentConfig.key}`;
      })();
      const generatedSignature = generateSignature(requestData);
      console.log('[OKPAY][Signature] String to sign:', signatureString);
      console.log('[OKPAY][Signature] Generated signature:', generatedSignature);

      // Generate signature
      requestData.sign = generatedSignature;
      
      // Call the payment gateway API
      const response = await axios.post(`${paymentConfig.host}/v1/Payout`, requestData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      
      // Log the full response from the gateway
      console.log('[OKPAY][Withdrawal] Gateway Response:', JSON.stringify(response.data, null, 2));
      
      // Check API response
      if (response.data.code === 0) {
        // Update withdrawal with transaction ID
        await withdrawal.update({
          transaction_id: response.data.data.transaction_Id
        }, { transaction: t });
        
        await t.commit();
        
        return {
          success: true,
          message: "Withdrawal approved and payment processing initiated",
          transactionId: response.data.data.transaction_Id
        };
      } else {
        // Payment gateway error
        await t.rollback();
        
        return {
          success: false,
          message: `Payment gateway error: ${response.data.msg}`,
          errorCode: response.data.code
        };
      }
    } catch (error) {
      await t.rollback();
      
      // Check if error is a lock timeout
      if (error.name === 'SequelizeDatabaseError' && 
          error.parent && 
          error.parent.code === 'ER_LOCK_WAIT_TIMEOUT') {
        
        retryCount++;
        console.warn(`Lock timeout detected for withdrawal ${withdrawalId}, retrying (${retryCount}/${maxRetries})`);
        
        if (retryCount < maxRetries) {
          // Wait for a random time between 100-500ms before retrying
          const delay = 100 + Math.floor(Math.random() * 400);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      console.error("Payment gateway API error:", error);
      
      return {
        success: false,
        message: "Error calling payment gateway"
      };
    }
  }
  
  // If we get here, all retries failed
  return {
    success: false,
    message: "Failed to process withdrawal after multiple attempts due to lock timeout"
  };
};

/**
 * Process PayIn callback from payment gateway
 * @param {Object} callbackData - Callback data from payment gateway
 * @returns {Object} - Processing result
 */
const processPayInCallback = async (callbackData) => {
  // Log all received callback data for deposit
  console.log('[OKPAY][Deposit Callback] Received Data:', JSON.stringify(callbackData, null, 2));
  // Extract callback data
  const {
      mchId,
      out_trade_no,
      transaction_Id,
      status,
      money,
      pay_money,
      sign,
      ...otherParams
  } = callbackData;
  
  // 1. Verify merchant ID
  if (mchId !== paymentConfig.mchId) {
      return {
          success: false,
          message: "Invalid merchant ID"
      };
  }
  
  // 2. Verify signature
  const dataToVerify = { ...callbackData };
  delete dataToVerify.sign;
  
  const calculatedSign = generateSignature(dataToVerify);
  if (sign !== calculatedSign) {
      return {
          success: false,
          message: "Invalid signature"
      };
  }
  
  // Start a transaction
  const t = await sequelize.transaction();
  
  try {
      // 3. Find the recharge record
      const rechargeRecord = await WalletRecharge.findOne({
          where: { order_id: out_trade_no },
          transaction: t
      });
      
      if (!rechargeRecord) {
          await t.rollback();
          return {
              success: false,
              message: "Order not found"
          };
      }
      
      // 4. Check if already processed
      if (rechargeRecord.status === 'completed') {
          await t.rollback();
          return {
              success: true,
              message: "Payment already processed"
          };
      }
      
      // 5. Process payment based on status
      if (status === "1") { // Payment successful
          // Update recharge record
          await WalletRecharge.update({
              status: 'completed',
              transaction_id: transaction_Id
          }, {
              where: { order_id: out_trade_no },
              transaction: t
          });
          
          // Get user
          const user = await User.findByPk(rechargeRecord.user_id, {
              transaction: t
          });
          
          if (!user) {
              await t.rollback();
              return {
                  success: false,
                  message: "User not found"
              };
          }
          
          // Update wallet balance
          // Use pay_money (actual amount paid) if available, otherwise use money (order amount)
          const addAmount = parseFloat(pay_money || money);
          const newBalance = parseFloat(user.wallet_balance) + addAmount;
          
          await User.update({
              wallet_balance: newBalance
          }, {
              where: { user_id: rechargeRecord.user_id },
              transaction: t
          });
          
          // Process first recharge bonus if applicable
          if (rechargeRecord.status === 'pending') {
              await referralService.processFirstRechargeBonus(rechargeRecord.user_id, addAmount);
          }

          // NEW: Update referral status for this user's referrer
          await referralService.updateReferralOnRecharge(rechargeRecord.user_id, addAmount);
          
          // --- Attendance update logic ---
          const todayIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
          const [attendance, created] = await AttendanceRecord.findOrCreate({
            where: { user_id: rechargeRecord.user_id, attendance_date: todayIST },
            defaults: {
              user_id: rechargeRecord.user_id,
              attendance_date: todayIST,
              date: todayIST,
              streak_count: 1,
              has_recharged: true,
              recharge_amount: addAmount,
              claim_eligible: true,
              bonus_amount: 0,
              bonus_claimed: false,
              created_at: new Date(),
              updated_at: new Date()
            }
          });
          if (!created) {
            await attendance.update({
              has_recharged: true,
              recharge_amount: (parseFloat(attendance.recharge_amount) || 0) + addAmount,
              claim_eligible: true,
              updated_at: new Date()
            });
          }
          // --- End Attendance update logic ---
          
          await t.commit();
          
          // IMPORTANT: These additional operations are performed AFTER the transaction is committed
          // to avoid prolonging the transaction and risking deadlocks
          
          // NEW: Update attendance record with recharge info
          // await autoProcessRechargeForAttendance(rechargeRecord.user_id, addAmount);
          
          // NEW: Update referral status for this user's referrer
          // await updateReferralOnRecharge(rechargeRecord.user_id, addAmount);
          
          return {
              success: true,
              message: "Payment processed successfully"
          };
      } else { // Payment failed
          await WalletRecharge.update({
              status: 'failed'
          }, {
              where: { order_id: out_trade_no },
              transaction: t
          });
          
          await t.commit();
          
          return {
              success: true,
              message: "Payment failure recorded"
          };
      }
  } catch (error) {
      await t.rollback();
      console.error("Error processing payment callback:", error);
      
      return {
          success: false,
          message: "Error processing payment callback"
      };
  }
};

/**
 * Process PayOut callback from payment gateway
 * @param {Object} callbackData - Callback data from payment gateway
 * @returns {Object} - Processing result
 */
const processPayOutCallback = async (callbackData) => {
  // Log all received callback data for withdrawal
  console.log('[OKPAY][Withdrawal Callback] Received Data:', JSON.stringify(callbackData, null, 2));
  // Extract callback data
  const {
    mchId,
    out_trade_no,
    transaction_Id,
    status,
    money,
    sign,
    ...otherParams
  } = callbackData;
  
  // 1. Verify merchant ID
  if (mchId !== paymentConfig.mchId) {
    return {
      success: false,
      message: "Invalid merchant ID"
    };
  }
  
  // 2. Verify signature (remove sign from verification)
  const dataToVerify = { ...callbackData };
  delete dataToVerify.sign;
  
  const calculatedSign = generateSignature(dataToVerify);
  if (sign !== calculatedSign) {
    return {
      success: false,
      message: "Invalid signature"
    };
  }
  
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    const t = await sequelize.transaction();
    
    try {
      // 3. Find the withdrawal record with lock to prevent concurrent updates
      const withdrawalRecord = await WalletWithdrawal.findOne({
        where: { transaction_id: out_trade_no },
        lock: true,
        transaction: t
      });
      
      if (!withdrawalRecord) {
        await t.rollback();
        return {
          success: false,
          message: "Order not found"
        };
      }
      
      // 4. Check if already processed
      if (withdrawalRecord.status === 'completed' || withdrawalRecord.status === 'failed') {
        await t.rollback();
        return {
          success: true,
          message: "Withdrawal already processed"
        };
      }
      
      // 5. Process withdrawal based on status
      if (status === "1") { // Withdrawal successful
        // Update withdrawal record
        await WalletWithdrawal.update({
          status: 'completed',
          transaction_id: transaction_Id
        }, {
          where: { transaction_id: out_trade_no },
          transaction: t
        });
        
        await t.commit();
        
        return {
          success: true,
          message: "Withdrawal processed successfully"
        };
      } else { // Withdrawal failed
        // Get user to refund
        const user = await User.findByPk(withdrawalRecord.user_id, {
          lock: true,
          transaction: t
        });
        
        if (!user) {
          await t.rollback();
          return {
            success: false,
            message: "User not found"
          };
        }
        
        // Refund wallet balance
        const newBalance = parseFloat(user.wallet_balance) + parseFloat(withdrawalRecord.amount);
        
        await User.update({
          wallet_balance: newBalance
        }, {
          where: { user_id: withdrawalRecord.user_id },
          transaction: t
        });
        
        // Update withdrawal record
        await WalletWithdrawal.update({
          status: 'failed'
        }, {
          where: { transaction_id: out_trade_no },
          transaction: t
        });
        
        await t.commit();
        
        return {
          success: true,
          message: "Withdrawal failure recorded and funds returned to wallet"
        };
      }
    } catch (error) {
      await t.rollback();
      
      // Check if error is a lock timeout
      if (error.name === 'SequelizeDatabaseError' && 
          error.parent && 
          error.parent.code === 'ER_LOCK_WAIT_TIMEOUT') {
        
        retryCount++;
        console.warn(`Lock timeout detected for withdrawal callback ${out_trade_no}, retrying (${retryCount}/${maxRetries})`);
        
        if (retryCount < maxRetries) {
          // Wait for a random time between 100-500ms before retrying
          const delay = 100 + Math.floor(Math.random() * 400);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      console.error("Error processing withdrawal callback:", error);
      
      return {
        success: false,
        message: "Error processing withdrawal callback"
      };
    }
  }
  
  // If we get here, all retries failed
  return {
    success: false,
    message: "Failed to process withdrawal callback after multiple attempts due to lock timeout"
  };
};

/**
 * Get payment status
 * @param {string} orderId - Order ID to check
 * @returns {Object} - Payment status
 */
const getPaymentStatus = async (orderId) => {
  try {
    // Determine if this is a PayIn or PayOut order
    const isPayIn = orderId.startsWith('PI');
    const isPayOut = orderId.startsWith('PO');
    
    if (isPayIn) {
      // Check PayIn status
      const rechargeRecord = await WalletRecharge.findOne({
        where: { order_id: orderId }
      });
      
      if (!rechargeRecord) {
        return {
          success: false,
          message: "Recharge order not found"
        };
      }
      
      return {
        success: true,
        type: 'payin',
        status: rechargeRecord.status === 'completed' ? 'success' : 'pending',
        amount: rechargeRecord.amount,
        transactionId: rechargeRecord.transaction_id,
        timestamp: rechargeRecord.updated_at || rechargeRecord.created_at,
        gateway: `Gateway ${rechargeRecord.payment_gateway_id}`
      };
    } else if (isPayOut) {
      // Check PayOut status
      const withdrawalRecord = await WalletWithdrawal.findOne({
        where: { transaction_id: orderId }
      });
      
      if (!withdrawalRecord) {
        return {
          success: false,
          message: "Withdrawal order not found"
        };
      }
      
      let status = 'pending';
      if (withdrawalRecord.status === 'completed') {
        status = 'success';
      } else if (withdrawalRecord.status === 'failed') {
        status = 'failed';
      } else if (withdrawalRecord.status === 'pending') {
        status = 'awaiting_approval';
      } else if (withdrawalRecord.status === 'rejected') {
        status = 'rejected';
      } else if (withdrawalRecord.status === 'approved') {
        status = 'processing';
      }
      
      return {
        success: true,
        type: 'payout',
        status: status,
        amount: withdrawalRecord.amount,
        transactionId: withdrawalRecord.transaction_id,
        timestamp: withdrawalRecord.updated_at || withdrawalRecord.created_at,
        adminStatus: withdrawalRecord.status,
        gateway: `Gateway ${withdrawalRecord.payment_gateway_id}`
      };
    } else {
      return {
        success: false,
        message: "Invalid order ID format"
      };
    }
  } catch (error) {
    console.error("Error getting payment status:", error);
    
    return {
      success: false,
      message: "Error checking payment status"
    };
  }
};

/**
 * Get pending withdrawals for admin approval
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of pending withdrawals with pagination
 */
const getPendingWithdrawals = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count of pending withdrawals
    const total = await WalletWithdrawal.count({
      where: { status: 'pending' }
    });
    
    // Get pending withdrawals with pagination
    const pendingWithdrawals = await WalletWithdrawal.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance']
        },
        {
          model: BankAccount,
          as: 'bankAccount',
          attributes: ['bank_name', 'account_number', 'ifsc_code', 'account_holder']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedWithdrawals = pendingWithdrawals.map(withdrawal => ({
      withdrawal_id: withdrawal.id,
      user_id: withdrawal.user.user_id,
      user_name: withdrawal.user.user_name,
      email: withdrawal.user.email,
      phone_no: withdrawal.user.phone_no,
      wallet_balance: withdrawal.user.wallet_balance,
      order_id: withdrawal.transaction_id,
      withdrawal_type: withdrawal.withdrawal_type,
      amount: withdrawal.amount,
      status: withdrawal.status,
      created_at: withdrawal.created_at,
      bank_name: withdrawal.bankAccount?.bank_name || null,
      account_number: withdrawal.bankAccount?.account_number || null,
      ifsc_code: withdrawal.bankAccount?.ifsc_code || null,
      account_holder: withdrawal.bankAccount?.account_holder || null
    }));
    
    return {
      success: true,
      withdrawals: formattedWithdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting pending withdrawals:', error);
    return {
      success: false,
      message: 'Error fetching pending withdrawals'
    };
  }
};

/**
 * Get withdrawals with admin filters
 * @param {Object} filters - Filter criteria
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of filtered withdrawals with pagination
 */
const getWithdrawalsAdmin = async (filters = {}, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Build where clause based on filters
    const whereClause = {};
    
    if (filters.status) {
      whereClause.status = filters.status;
    }
    
    if (filters.user_id) {
      whereClause.user_id = filters.user_id;
    }
    
    // Date filters
    if (filters.start_date && filters.end_date) {
      whereClause.created_at = {
        [Op.between]: [new Date(filters.start_date), new Date(filters.end_date)]
      };
    } else if (filters.start_date) {
      whereClause.created_at = {
        [Op.gte]: new Date(filters.start_date)
      };
    } else if (filters.end_date) {
      whereClause.created_at = {
        [Op.lte]: new Date(filters.end_date)
      };
    }
    
    // Get total count
    const total = await WalletWithdrawal.count({ where: whereClause });
    
    // Get withdrawals with pagination
    const withdrawals = await WalletWithdrawal.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no']
        },
        {
          model: WithdrawalAdmin,
          required: false,
          as: 'WithdrawalAdmin'
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    
    return {
      success: true,
      withdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting admin withdrawals:', error);
    return {
      success: false,
      message: 'Error fetching withdrawals'
    };
  }
};

/**
 * Get successful withdrawals for admin
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {Object} filters - Additional filters
 * @returns {Object} - List of successful withdrawals with pagination
 */
const getSuccessfulWithdrawals = async (page = 1, limit = 10, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    
    // Build where clause for successful withdrawals
    const whereClause = {
      status: 'completed'
    };
    
    // Add additional filters
    if (filters.user_id) {
      whereClause.user_id = filters.user_id;
    }
    
    // Date filters
    if (filters.start_date && filters.end_date) {
      whereClause.updated_at = {
        [Op.between]: [new Date(filters.start_date), new Date(filters.end_date)]
      };
    } else if (filters.start_date) {
      whereClause.updated_at = {
        [Op.gte]: new Date(filters.start_date)
      };
    } else if (filters.end_date) {
      whereClause.updated_at = {
        [Op.lte]: new Date(filters.end_date)
      };
    }
    
    // Get total count
    const total = await WalletWithdrawal.count({ where: whereClause });
    
    // Get successful withdrawals with pagination
    const successfulWithdrawals = await WalletWithdrawal.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance']
        },
        {
          model: BankAccount,
          as: 'bankAccount',
          attributes: ['bank_name', 'account_number', 'ifsc_code', 'account_holder']
        },
        {
          model: WithdrawalAdmin,
          required: false,
          attributes: ['admin_id', 'notes', 'created_at'],
          as: 'WithdrawalAdmin'
        }
      ],
      order: [['updated_at', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedWithdrawals = successfulWithdrawals.map(withdrawal => ({
      withdrawal_id: withdrawal.id,
      user_id: withdrawal.user.user_id,
      user_name: withdrawal.user.user_name,
      email: withdrawal.user.email,
      phone_no: withdrawal.user.phone_no,
      wallet_balance: withdrawal.user.wallet_balance,
      order_id: withdrawal.transaction_id,
      withdrawal_type: withdrawal.withdrawal_type,
      amount: withdrawal.amount,
      status: withdrawal.status,
      created_at: withdrawal.created_at,
      completed_at: withdrawal.updated_at,
      bank_name: withdrawal.bankAccount?.bank_name || null,
      account_number: withdrawal.bankAccount?.account_number || null,
      ifsc_code: withdrawal.bankAccount?.ifsc_code || null,
      account_holder: withdrawal.bankAccount?.account_holder || null,
      admin_notes: withdrawal.WithdrawalAdmin?.notes || null,
      processed_by_admin: withdrawal.WithdrawalAdmin?.admin_id || null,
      admin_processed_at: withdrawal.WithdrawalAdmin?.created_at || null
    }));
    
    return {
      success: true,
      withdrawals: formattedWithdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting successful withdrawals:', error);
    return {
      success: false,
      message: 'Error fetching successful withdrawals'
    };
  }
};

/**
 * Get failed withdrawals for admin
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {Object} filters - Additional filters
 * @returns {Object} - List of failed withdrawals with pagination
 */
const getFailedWithdrawals = async (page = 1, limit = 10, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    
    // Build where clause for failed withdrawals
    const whereClause = {
      status: 'failed'
    };
    
    // Add additional filters
    if (filters.user_id) {
      whereClause.user_id = filters.user_id;
    }
    
    // Date filters
    if (filters.start_date && filters.end_date) {
      whereClause.updated_at = {
        [Op.between]: [new Date(filters.start_date), new Date(filters.end_date)]
      };
    } else if (filters.start_date) {
      whereClause.updated_at = {
        [Op.gte]: new Date(filters.start_date)
      };
    } else if (filters.end_date) {
      whereClause.updated_at = {
        [Op.lte]: new Date(filters.end_date)
      };
    }
    
    // Get total count
    const total = await WalletWithdrawal.count({ where: whereClause });
    
    // Get failed withdrawals with pagination
    const failedWithdrawals = await WalletWithdrawal.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance']
        },
        {
          model: BankAccount,
          as: 'bankAccount',
          attributes: ['bank_name', 'account_number', 'ifsc_code', 'account_holder']
        },
        {
          model: WithdrawalAdmin,
          required: false,
          attributes: ['admin_id', 'notes', 'created_at'],
          as: 'WithdrawalAdmin'
        }
      ],
      order: [['updated_at', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedWithdrawals = failedWithdrawals.map(withdrawal => ({
      withdrawal_id: withdrawal.id,
      user_id: withdrawal.user.user_id,
      user_name: withdrawal.user.user_name,
      email: withdrawal.user.email,
      phone_no: withdrawal.user.phone_no,
      wallet_balance: withdrawal.user.wallet_balance,
      order_id: withdrawal.transaction_id,
      withdrawal_type: withdrawal.withdrawal_type,
      amount: withdrawal.amount,
      status: withdrawal.status,
      created_at: withdrawal.created_at,
      failed_at: withdrawal.updated_at,
      bank_name: withdrawal.bankAccount?.bank_name || null,
      account_number: withdrawal.bankAccount?.account_number || null,
      ifsc_code: withdrawal.bankAccount?.ifsc_code || null,
      account_holder: withdrawal.bankAccount?.account_holder || null,
      admin_notes: withdrawal.WithdrawalAdmin?.notes || null,
      processed_by_admin: withdrawal.WithdrawalAdmin?.admin_id || null,
      admin_processed_at: withdrawal.WithdrawalAdmin?.created_at || null,
      failure_reason: withdrawal.failure_reason || 'Payment gateway failure'
    }));
    
    return {
      success: true,
      withdrawals: formattedWithdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting failed withdrawals:', error);
    return {
      success: false,
      message: 'Error fetching failed withdrawals'
    };
  }
};

/**
 * Get all pending recharge requests using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of pending recharges with pagination
 */
const getAllPendingRecharges = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count of pending recharges
    const total = await WalletRecharge.count({
      where: { status: 'pending' }
    });
    
    // Get pending recharges with pagination
    const pendingRecharges = await WalletRecharge.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'created_at']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedRecharges = pendingRecharges.map(recharge => ({
      user_id: recharge.user.user_id,
      mobile_number: recharge.user.phone_no,
      order_id: recharge.order_id || recharge.id,
      recharge_type: `Gateway ${recharge.payment_gateway_id}`,
      applied_amount: recharge.amount,
      balance_after: (parseFloat(recharge.user.wallet_balance) + parseFloat(recharge.amount)).toFixed(2),
      apply_date_time: recharge.created_at,
      recharge_id: recharge.id,
      user_registered_at: recharge.user.created_at
    }));
    
    return {
      success: true,
      recharges: formattedRecharges,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting pending recharges:', error);
    return {
      success: false,
      message: 'Error fetching pending recharges'
    };
  }
};

/**
 * Get successful first-time recharges using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of first-time recharges with pagination
 */
const getFirstRecharges = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // First, let's test a simple query without associations
    console.log('Testing basic WalletRecharge query...');
    
    // Get all successful recharges with basic user info
    const successfulRecharges = await WalletRecharge.findAll({
      where: { status: 'completed' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'actual_deposit_amount', 'created_at']
        }
      ],
      order: [['updated_at', 'DESC']]
    });

    console.log(`Found ${successfulRecharges.length} successful recharges`);

    // Create a map to track each user's first successful recharge
    const userFirstRecharges = new Map();
    successfulRecharges.forEach(recharge => {
      if (!userFirstRecharges.has(recharge.user_id)) {
        userFirstRecharges.set(recharge.user_id, recharge);
      }
    });

    // Convert Map to array and apply pagination
    const firstRecharges = Array.from(userFirstRecharges.values())
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(offset, offset + limit);

    // Transform the data to match required format
    const formattedRecharges = firstRecharges.map(recharge => ({
      user_id: recharge.user.user_id,
      mobile_number: recharge.user.phone_no,
      order_id: recharge.order_id || recharge.id,
      recharge_type: `Gateway ${recharge.payment_gateway_id}`,
      applied_amount: recharge.amount,
      balance_after: (parseFloat(recharge.user.wallet_balance)).toFixed(2),
      total_recharge: recharge.user.actual_deposit_amount || 0,
      total_withdraw: 0, // We'll need to calculate this from withdrawals table if needed
      apply_date_time: recharge.updated_at,
      recharge_id: recharge.id,
      is_first_recharge: true,
      user_registered_at: recharge.user.created_at,
      transaction_id: recharge.transaction_id || 'N/A'
    }));
    
    return {
      success: true,
      recharges: formattedRecharges,
      pagination: {
        total: userFirstRecharges.size,
        page,
        limit,
        pages: Math.ceil(userFirstRecharges.size / limit)
      }
    };
  } catch (error) {
    console.error('Error getting first recharges:', error);
    return {
      success: false,
      message: 'Error fetching first recharges'
    };
  }
};

/**
 * Get today's top deposits using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of top deposits with pagination
 */
const getTodayTopDeposits = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get total count of today's successful deposits
    const total = await WalletRecharge.count({
      where: { 
        status: 'completed',
        updated_at: {
          [Op.gte]: today
        }
      }
    });
    
    // Get today's successful deposits with pagination
    const deposits = await WalletRecharge.findAll({
      where: { 
        status: 'completed',
        updated_at: {
          [Op.gte]: today
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'actual_deposit_amount', 'created_at']
        }
      ],
      order: [['amount', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedDeposits = deposits.map(deposit => ({
      user_id: deposit.user.user_id,
      mobile_number: deposit.user.phone_no,
      order_id: deposit.order_id || deposit.id,
      recharge_type: `Gateway ${deposit.payment_gateway_id}`,
      applied_amount: deposit.amount,
      balance_after: (parseFloat(deposit.user.wallet_balance)).toFixed(2),
      total_recharge: deposit.user.actual_deposit_amount || 0,
      total_withdraw: 0, // We'll need to calculate this from withdrawals table if needed
      apply_date_time: deposit.updated_at,
      recharge_id: deposit.id,
      user_registered_at: deposit.user.created_at,
      transaction_id: deposit.transaction_id || 'N/A'
    }));
    
    return {
      success: true,
      deposits: formattedDeposits,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting today\'s top deposits:', error);
    return {
      success: false,
      message: 'Error fetching today\'s top deposits'
    };
  }
};

/**
 * Get all successful recharges using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of successful recharges with pagination
 */
const getAllSuccessfulRecharges = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count of successful recharges
    const total = await WalletRecharge.count({
      where: { status: 'completed' }
    });
    
    // Get successful recharges with pagination
    const successfulRecharges = await WalletRecharge.findAll({
      where: { status: 'completed' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'actual_deposit_amount', 'created_at']
        }
      ],
      order: [['updated_at', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedRecharges = successfulRecharges.map(recharge => ({
      user_id: recharge.user.user_id,
      mobile_number: recharge.user.phone_no,
      order_id: recharge.order_id || recharge.id,
      recharge_type: `Gateway ${recharge.payment_gateway_id}`,
      applied_amount: recharge.amount,
      balance_after: (parseFloat(recharge.user.wallet_balance)).toFixed(2),
      total_recharge: recharge.user.actual_deposit_amount || 0,
      total_withdraw: 0, // We'll need to calculate this from withdrawals table if needed
      apply_date_time: recharge.updated_at,
      recharge_id: recharge.id,
      user_registered_at: recharge.user.created_at,
      transaction_id: recharge.transaction_id || 'N/A'
    }));
    
    return {
      success: true,
      recharges: formattedRecharges,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting successful recharges:', error);
    return {
      success: false,
      message: 'Error fetching successful recharges'
    };
  }
};

/**
 * Get today's top withdrawals using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of top withdrawals with pagination
 */
const getTodayTopWithdrawals = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get total count of today's successful withdrawals
    const total = await WalletWithdrawal.count({
      where: { 
        status: 'completed',
        updated_at: {
          [Op.gte]: today
        }
      }
    });
    
    // Get today's successful withdrawals with pagination
    const withdrawals = await WalletWithdrawal.findAll({
      where: { 
        status: 'completed',
        updated_at: {
          [Op.gte]: today
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'actual_deposit_amount', 'created_at']
        },
        {
          model: BankAccount,
          as: 'bankAccount',
          attributes: ['bank_name', 'account_number', 'ifsc_code', 'account_holder']
        }
      ],
      order: [['amount', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedWithdrawals = withdrawals.map(withdrawal => ({
      user_id: withdrawal.user.user_id,
      mobile_number: withdrawal.user.phone_no,
      order_id: withdrawal.transaction_id || withdrawal.id,
      withdraw_type: withdrawal.withdrawal_type || 'BANK',
      applied_amount: withdrawal.amount,
      balance_after: (parseFloat(withdrawal.user.wallet_balance)).toFixed(2),
      total_recharge: withdrawal.user.actual_deposit_amount || 0,
      total_withdraw: 0, // We'll need to calculate this from withdrawals table if needed
      bank_name: withdrawal.bankAccount?.bank_name || 'N/A',
      account_number: withdrawal.bankAccount?.account_number || 'N/A',
      ifsc_code: withdrawal.bankAccount?.ifsc_code || 'N/A',
      account_holder: withdrawal.bankAccount?.account_holder || 'N/A',
      usdt_network: 'N/A', // Not available in current schema
      usdt_address: 'N/A', // Not available in current schema
      address_alias: 'N/A', // Not available in current schema
      apply_date_time: withdrawal.updated_at,
      withdrawal_id: withdrawal.id,
      transaction_id: withdrawal.transaction_id || 'N/A'
    }));
    
    return {
      success: true,
      withdrawals: formattedWithdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting today\'s top withdrawals:', error);
    return {
      success: false,
      message: 'Error fetching today\'s top withdrawals'
    };
  }
};

/**
 * Get Spribe transaction statistics by provider for different time periods
 * @param {string} period - 'today', 'week', or 'month'
 * @returns {Object} - Statistics grouped by provider
 */
const getSpribeTransactionStats = async (period = 'today') => {
  try {
    let startDate, endDate;
    const now = new Date();
    
    // Calculate date range based on period
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday is start of week
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    // Get bet transactions
    const betTransactions = await SpribeTransaction.findAll({
      where: {
        type: 'bet',
        status: 'completed',
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'provider',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_bet_amount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_bet_count']
      ],
      group: ['provider'],
      raw: true
    });

    // Get win transactions
    const winTransactions = await SpribeTransaction.findAll({
      where: {
        type: 'win',
        status: 'completed',
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'provider',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_win_amount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_win_count']
      ],
      group: ['provider'],
      raw: true
    });

    // Combine and format results
    const providerStats = {};
    
    // Process bet transactions
    betTransactions.forEach(bet => {
      providerStats[bet.provider] = {
        provider: bet.provider,
        total_bet_amount: parseInt(bet.total_bet_amount) / 100, // Convert from cents
        total_bet_count: parseInt(bet.total_bet_count),
        total_win_amount: 0,
        total_win_count: 0,
        net_profit: 0
      };
    });

    // Process win transactions
    winTransactions.forEach(win => {
      if (providerStats[win.provider]) {
        providerStats[win.provider].total_win_amount = parseInt(win.total_win_amount) / 100;
        providerStats[win.provider].total_win_count = parseInt(win.total_win_count);
      } else {
        providerStats[win.provider] = {
          provider: win.provider,
          total_bet_amount: 0,
          total_bet_count: 0,
          total_win_amount: parseInt(win.total_win_amount) / 100,
          total_win_count: parseInt(win.total_win_count),
          net_profit: 0
        };
      }
    });

    // Calculate net profit for each provider
    Object.values(providerStats).forEach(stat => {
      stat.net_profit = stat.total_win_amount - stat.total_bet_amount;
    });

    // Convert to array and sort by total bet amount
    const statsArray = Object.values(providerStats).sort((a, b) => b.total_bet_amount - a.total_bet_amount);

    // Calculate totals
    const totals = statsArray.reduce((acc, stat) => {
      acc.total_bet_amount += stat.total_bet_amount;
      acc.total_bet_count += stat.total_bet_count;
      acc.total_win_amount += stat.total_win_amount;
      acc.total_win_count += stat.total_win_count;
      acc.net_profit += stat.net_profit;
      return acc;
    }, {
      total_bet_amount: 0,
      total_bet_count: 0,
      total_win_amount: 0,
      total_win_count: 0,
      net_profit: 0
    });

    return {
      success: true,
      period,
      start_date: startDate,
      end_date: endDate,
      providers: statsArray,
      totals
    };
  } catch (error) {
    console.error('Error getting Spribe transaction stats:', error);
    return {
      success: false,
      message: 'Error fetching Spribe transaction statistics'
    };
  }
};

/**
 * Get Seamless transaction statistics by provider for different time periods
 * @param {string} period - 'today', 'week', or 'month'
 * @returns {Object} - Statistics grouped by provider
 */
const getSeamlessTransactionStats = async (period = 'today') => {
  try {
    let startDate, endDate;
    const now = new Date();
    
    // Calculate date range based on period
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday is start of week
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    // Get debit transactions (bets)
    const debitTransactions = await SeamlessTransaction.findAll({
      where: {
        type: 'debit',
        status: 'success',
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'provider',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_bet_amount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_bet_count']
      ],
      group: ['provider'],
      raw: true
    });

    // Get credit transactions (wins)
    const creditTransactions = await SeamlessTransaction.findAll({
      where: {
        type: 'credit',
        status: 'success',
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'provider',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_win_amount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_win_count']
      ],
      group: ['provider'],
      raw: true
    });

    // Combine and format results
    const providerStats = {};
    
    // Process debit transactions (bets)
    debitTransactions.forEach(debit => {
      providerStats[debit.provider] = {
        provider: debit.provider,
        total_bet_amount: parseFloat(debit.total_bet_amount),
        total_bet_count: parseInt(debit.total_bet_count),
        total_win_amount: 0,
        total_win_count: 0,
        net_profit: 0
      };
    });

    // Process credit transactions (wins)
    creditTransactions.forEach(credit => {
      if (providerStats[credit.provider]) {
        providerStats[credit.provider].total_win_amount = parseFloat(credit.total_win_amount);
        providerStats[credit.provider].total_win_count = parseInt(credit.total_win_count);
      } else {
        providerStats[credit.provider] = {
          provider: credit.provider,
          total_bet_amount: 0,
          total_bet_count: 0,
          total_win_amount: parseFloat(credit.total_win_amount),
          total_win_count: parseInt(credit.total_win_count),
          net_profit: 0
        };
      }
    });

    // Calculate net profit for each provider
    Object.values(providerStats).forEach(stat => {
      stat.net_profit = stat.total_win_amount - stat.total_bet_amount;
    });

    // Convert to array and sort by total bet amount
    const statsArray = Object.values(providerStats).sort((a, b) => b.total_bet_amount - a.total_bet_amount);

    // Calculate totals
    const totals = statsArray.reduce((acc, stat) => {
      acc.total_bet_amount += stat.total_bet_amount;
      acc.total_bet_count += stat.total_bet_count;
      acc.total_win_amount += stat.total_win_amount;
      acc.total_win_count += stat.total_win_count;
      acc.net_profit += stat.net_profit;
      return acc;
    }, {
      total_bet_amount: 0,
      total_bet_count: 0,
      total_win_amount: 0,
      total_win_count: 0,
      net_profit: 0
    });

    return {
      success: true,
      period,
      start_date: startDate,
      end_date: endDate,
      providers: statsArray,
      totals
    };
  } catch (error) {
    console.error('Error getting Seamless transaction stats:', error);
    return {
      success: false,
      message: 'Error fetching Seamless transaction statistics'
    };
  }
};

module.exports = {
  createPayInOrder,
  initiateWithdrawal,
  processWithdrawalAdminAction,
  processRechargeAdminAction, // Added this line
  processOkPayTransfer,
  processPayInCallback,
  processPayOutCallback,
  getPaymentStatus,
  getPendingWithdrawals,
  getWithdrawalsAdmin,
  getSuccessfulWithdrawals,
  getFailedWithdrawals,
  getAllPendingRecharges,
  getAllSuccessfulRecharges,
  getFirstRecharges,
  getTodayTopDeposits,
  getTodayTopWithdrawals,
  getSpribeTransactionStats,
  getSeamlessTransactionStats
};
