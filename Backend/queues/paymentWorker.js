const { Worker } = require('bullmq');
const { getWorkerModels } = require('../workers/workerInit');
const queueConnections = require('../config/queueConfig');

const worker = new Worker('payments', async job => {
  const { type, data } = job.data;
  
  try {
    const models = getWorkerModels(); // No async call - uses pre-initialized models
    
    switch (type) {
      case 'processDepositCallback':
        await processDepositCallbackWithRetry(data, models);
        console.log(`[BullMQ] Deposit callback processed for order ${data.orderId}`);
        break;
        
      case 'processWithdrawalCallback':
        await processWithdrawalCallbackWithRetry(data, models);
        console.log(`[BullMQ] Withdrawal callback processed for order ${data.orderId}`);
        break;
        
      case 'checkPaymentStatus':
        await checkPaymentStatusWithRetry(data, models);
        console.log(`[BullMQ] Payment status checked for ${data.orderId}`);
        break;
        
      case 'retryPayment':
        await retryPaymentWithRetry(data, models);
        console.log(`[BullMQ] Payment retry for ${data.orderId}`);
        break;
        
      case 'processGatewayCallback':
        await processGatewayCallbackWithRetry(data, models);
        console.log(`[BullMQ] Gateway callback processed for ${data.gateway}`);
        break;
        
      default:
        throw new Error(`Unknown payment job type: ${type}`);
    }
  } catch (error) {
    console.error(`[BullMQ] Payment job failed (${type}):`, error.message);
    
    // Determine if error is retryable
    if (isRetryableError(error)) {
      throw error; // Will trigger retry
    } else {
      // Log and fail permanently
      await logPermanentFailure(job, error);
      throw new Error(`Non-retryable error: ${error.message}`);
    }
  }
}, { 
  connection: queueConnections.payments,
  concurrency: 10, // Higher concurrency for payment processing
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1
  }
});

// Enhanced deposit callback processing
async function processDepositCallbackWithRetry(data, models, maxRetries = 3) {
  const { orderId, status, transactionId, amount, gateway, signature } = data;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      // Find the deposit record
      const deposit = await models.WalletRecharge.findOne({
        where: { order_id: orderId },
        transaction
      });
      
      if (!deposit) {
        throw new Error(`Deposit order ${orderId} not found`);
      }
      
      // Verify signature if provided
      if (signature && !verifyGatewaySignature(data, gateway)) {
        throw new Error('Invalid gateway signature');
      }
      
      // Update deposit status
      await deposit.update({
        status: status === 'success' ? 'completed' : 'failed',
        payment_status: status === 'success',
        transaction_id: transactionId || deposit.transaction_id,
        time_of_success: status === 'success' ? new Date() : null,
        updated_at: new Date()
      }, { transaction });
      
      // If successful, process the deposit
      if (status === 'success') {
        // Add deposit processing job
        const depositQueue = require('./depositQueue');
        depositQueue.add('processDeposit', {
          userId: deposit.user_id,
          amount: amount || deposit.amount,
          orderId: orderId,
          transactionId: transactionId,
          paymentGateway: gateway || deposit.payment_gateway
        }, {
          priority: 10,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 }
        }).catch(console.error);
        
        console.log(`✅ Deposit callback processed successfully for order ${orderId}`);
      } else {
        console.log(`❌ Deposit failed for order ${orderId}: ${status}`);
      }
      
      await transaction.commit();
      return { success: true, status };
      
    } catch (error) {
      await transaction.rollback();
      
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for deposit callback ${orderId}, retrying (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
}

// Enhanced withdrawal callback processing
async function processWithdrawalCallbackWithRetry(data, models, maxRetries = 3) {
  const { orderId, status, transactionId, gateway, signature, failureReason } = data;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      // Find the withdrawal record
      const withdrawal = await models.WalletWithdrawal.findOne({
        where: { order_id: orderId },
        transaction
      });
      
      if (!withdrawal) {
        throw new Error(`Withdrawal order ${orderId} not found`);
      }
      
      // Verify signature if provided
      if (signature && !verifyGatewaySignature(data, gateway)) {
        throw new Error('Invalid gateway signature');
      }
      
      // Update withdrawal status
      await withdrawal.update({
        status: status === 'success' ? 'completed' : 'failed',
        transaction_id: transactionId || withdrawal.transaction_id,
        failure_reason: status !== 'success' ? failureReason : null,
        updated_at: new Date()
      }, { transaction });
      
      // Update transaction status
      await models.Transaction.update({
        status: status === 'success' ? 'completed' : 'failed',
        description: status === 'success' ? 'Withdrawal completed' : `Withdrawal failed: ${failureReason}`
      }, {
        where: {
          user_id: withdrawal.user_id,
          reference_id: orderId
        },
        transaction
      });
      
      // If failed, refund the amount
      if (status !== 'success') {
        const user = await models.User.findByPk(withdrawal.user_id, {
          lock: transaction.LOCK.UPDATE,
          transaction
        });
        
        if (user) {
          const newBalance = parseFloat(user.wallet_balance) + parseFloat(withdrawal.amount);
          await models.User.update({
            wallet_balance: newBalance
          }, {
            where: { user_id: withdrawal.user_id },
            transaction
          });
          
          // Create refund transaction
          await models.Transaction.create({
            user_id: withdrawal.user_id,
            type: 'withdrawal_refund',
            amount: parseFloat(withdrawal.amount),
            status: 'completed',
            description: `Withdrawal refund - ${failureReason}`,
            reference_id: `refund_${withdrawal.id}_${Date.now()}`,
            metadata: {
              withdrawal_id: withdrawal.id,
              refund_reason: failureReason
            }
          }, { transaction });
          
          console.log(`✅ Withdrawal refunded for user ${withdrawal.user_id}: ${withdrawal.amount}`);
        }
      }
      
      await transaction.commit();
      console.log(`✅ Withdrawal callback processed for order ${orderId}: ${status}`);
      return { success: true, status };
      
    } catch (error) {
      await transaction.rollback();
      
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for withdrawal callback ${orderId}, retrying (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
}

// Enhanced payment status checking
async function checkPaymentStatusWithRetry(data, models, maxRetries = 3) {
  const { orderId, gateway, type } = data; // type: 'deposit' or 'withdrawal'
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check payment status from gateway
      const status = await checkGatewayStatus(orderId, gateway);
      
      if (status === 'pending' && attempt < maxRetries) {
        // Schedule another check
        const paymentQueue = require('./paymentQueue');
        paymentQueue.add('checkPaymentStatus', {
          orderId,
          gateway,
          type
        }, {
          delay: 60000, // Check again in 1 minute
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 }
        }).catch(console.error);
        
        return { success: true, status: 'pending' };
      }
      
      // Process the status
      if (type === 'deposit') {
        const depositQueue = require('./depositQueue');
        depositQueue.add('updateDepositStatus', {
          orderId,
          status,
          transactionId: status === 'success' ? `TXN_${Date.now()}` : null
        }, {
          priority: 5,
          attempts: 3
        }).catch(console.error);
      } else {
        const withdrawalQueue = require('./withdrawalQueue');
        withdrawalQueue.add('updateWithdrawalStatus', {
          orderId,
          status,
          transactionId: status === 'success' ? `TXN_${Date.now()}` : null,
          failureReason: status !== 'success' ? 'Payment gateway timeout' : null
        }, {
          priority: 5,
          attempts: 3
        }).catch(console.error);
      }
      
      console.log(`✅ Payment status checked for ${orderId}: ${status}`);
      return { success: true, status };
      
    } catch (error) {
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for status check ${orderId}, retrying (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
}

// Enhanced payment retry
async function retryPaymentWithRetry(data, models, maxRetries = 3) {
  const { orderId, gateway, type, retryCount = 0 } = data;
  
  if (retryCount >= 3) {
    console.log(`Max retries reached for payment ${orderId}`);
    return { success: false, message: 'Max retries reached' };
  }
  
  try {
    // Retry the payment
    const result = await retryGatewayPayment(orderId, gateway, type);
    
    if (result.success) {
      console.log(`✅ Payment retry successful for ${orderId}`);
      return { success: true };
    } else {
      // Schedule another retry
      const paymentQueue = require('./paymentQueue');
      paymentQueue.add('retryPayment', {
        orderId,
        gateway,
        type,
        retryCount: retryCount + 1
      }, {
        delay: 300000, // Retry in 5 minutes
        attempts: 1
      }).catch(console.error);
      
      return { success: false, message: 'Scheduled for retry' };
    }
    
  } catch (error) {
    console.error(`Payment retry failed for ${orderId}:`, error);
    throw error;
  }
}

// Enhanced gateway callback processing
async function processGatewayCallbackWithRetry(data, models, maxRetries = 3) {
  const { gateway, callbackData, type } = data;
  
  try {
    // Process based on gateway type
    switch (gateway.toLowerCase()) {
      case 'okpay':
        return await processOkPayCallback(callbackData, type);
      case 'wepay':
        return await processWePayCallback(callbackData, type);
      case 'mxpay':
        return await processMxPayCallback(callbackData, type);
      case 'ghpay':
        return await processGhPayCallback(callbackData, type);
      default:
        throw new Error(`Unsupported gateway: ${gateway}`);
    }
  } catch (error) {
    console.error(`Gateway callback processing failed for ${gateway}:`, error);
    throw error;
  }
}

// Helper functions for gateway integration
async function checkGatewayStatus(orderId, gateway) {
  // This would integrate with your actual payment gateway APIs
  // For now, return a mock status
  console.log(`Checking status for order ${orderId} via ${gateway}`);
  return 'success'; // Mock response
}

async function retryGatewayPayment(orderId, gateway, type) {
  // This would integrate with your actual payment gateway APIs
  console.log(`Retrying payment for order ${orderId} via ${gateway}`);
  return { success: true }; // Mock response
}

function verifyGatewaySignature(data, gateway) {
  // This would verify the gateway signature
  // For now, return true
  return true;
}

// Gateway-specific callback processors
async function processOkPayCallback(callbackData, type) {
  // Process OKPAY callback
  console.log('Processing OKPAY callback:', callbackData);
  return { success: true };
}

async function processWePayCallback(callbackData, type) {
  // Process WEPAY callback
  console.log('Processing WEPAY callback:', callbackData);
  return { success: true };
}

async function processMxPayCallback(callbackData, type) {
  // Process MXPAY callback
  console.log('Processing MXPAY callback:', callbackData);
  return { success: true };
}

async function processGhPayCallback(callbackData, type) {
  // Process GHPAY callback
  console.log('Processing GHPAY callback:', callbackData);
  return { success: true };
}

// Helper functions
function isRetryableError(error) {
  const retryableErrors = [
    'SequelizeDeadlockError',
    'SequelizeConnectionError',
    'SequelizeConnectionRefusedError',
    'SequelizeConnectionTimedOutError',
    'TimeoutError'
  ];
  return retryableErrors.includes(error.name);
}

async function logPermanentFailure(job, error) {
  console.error('Permanent payment job failure:', {
    jobId: job.id,
    jobData: job.data,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

worker.on('completed', job => {
  console.log(`[BullMQ] Payment job completed:`, job.id);
});

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Payment job failed:`, job.id, err.message);
});

module.exports = worker; 