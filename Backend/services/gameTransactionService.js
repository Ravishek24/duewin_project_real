// services/gameTransactionService.js
const { sequelize } = require('../config/db');
const GameTransaction = require('../models/GameTransaction');
const GameSession = require('../models/GameSession');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

/**
 * Create game session when user launches a game
 * @param {number} userId - User ID
 * @param {string} gameId - Game ID
 * @param {string} provider - Provider name
 * @param {string} token - Launch token
 * @param {string} currency - Currency code
 * @param {string} ipAddress - User's IP address
 * @returns {Object} Session information
 */
const createGameSession = async (userId, gameId, provider, token, currency, ipAddress) => {
  try {
    const session = await GameSession.create({
      user_id: userId,
      provider,
      game_id: gameId,
      launch_token: token,
      currency,
      ip_address: ipAddress,
      is_active: true,
      start_time: new Date(),
    });
    
    return {
      success: true,
      session
    };
  } catch (error) {
    console.error('Error creating game session:', error);
    return {
      success: false,
      message: 'Failed to create game session'
    };
  }
};

/**
 * Update game session with session token from provider
 * @param {string} launchToken - Launch token
 * @param {string} sessionToken - Session token from provider
 * @param {string} platform - Platform (mobile/desktop)
 * @returns {Object} Updated session
 */
const updateGameSession = async (launchToken, sessionToken, platform) => {
  try {
    const session = await GameSession.findOne({ 
      where: { launch_token: launchToken }
    });
    
    if (!session) {
      return {
        success: false,
        message: 'Session not found'
      };
    }
    
    await session.update({
      session_token: sessionToken,
      platform,
      updated_at: new Date()
    });
    
    return {
      success: true,
      session
    };
  } catch (error) {
    console.error('Error updating game session:', error);
    return {
      success: false,
      message: 'Failed to update game session'
    };
  }
};

/**
 * End game session
 * @param {string} sessionToken - Session token
 * @returns {Object} Result
 */
const endGameSession = async (sessionToken) => {
  try {
    const session = await GameSession.findOne({ 
      where: { session_token: sessionToken }
    });
    
    if (!session) {
      return {
        success: false,
        message: 'Session not found'
      };
    }
    
    await session.update({
      is_active: false,
      end_time: new Date(),
      updated_at: new Date()
    });
    
    return {
      success: true,
      message: 'Session ended successfully'
    };
  } catch (error) {
    console.error('Error ending game session:', error);
    return {
      success: false,
      message: 'Failed to end game session'
    };
  }
};

/**
 * Create a game transaction
 * @param {Object} transaction - Transaction data
 * @param {Object} transaction - Database transaction instance
 * @returns {Object} Created transaction
 */
const createGameTransaction = async (transactionData, dbTransaction = null) => {
  try {
    // Generate operator transaction ID
    const operatorTxId = uuidv4();
    
    // Create transaction record
    const transaction = await GameTransaction.create({
      user_id: transactionData.user_id,
      provider: transactionData.provider,
      game_id: transactionData.game_id,
      provider_tx_id: transactionData.provider_tx_id,
      operator_tx_id: operatorTxId,
      type: transactionData.type,
      amount: transactionData.amount,
      currency: transactionData.currency,
      status: transactionData.status || 'completed',
      action_id: transactionData.action_id,
      platform: transactionData.platform,
      ip_address: transactionData.ip_address,
      related_tx_id: transactionData.related_tx_id,
      created_at: new Date(),
      updated_at: new Date()
    }, {
      transaction: dbTransaction
    });
    
    return {
      success: true,
      transaction,
      operator_tx_id: operatorTxId
    };
  } catch (error) {
    console.error('Error creating game transaction:', error);
    return {
      success: false,
      message: 'Failed to create game transaction'
    };
  }
};

/**
 * Find a game transaction by provider transaction ID
 * @param {string} providerTxId - Provider transaction ID
 * @returns {Object} Transaction if found
 */
const findTransactionByProviderTxId = async (providerTxId) => {
  try {
    const transaction = await GameTransaction.findOne({
      where: { provider_tx_id: providerTxId }
    });
    
    if (!transaction) {
      return {
        success: false,
        message: 'Transaction not found'
      };
    }
    
    return {
      success: true,
      transaction
    };
  } catch (error) {
    console.error('Error finding transaction:', error);
    return {
      success: false,
      message: 'Failed to find transaction'
    };
  }
};

/**
 * Update a game transaction status
 * @param {number} transactionId - Transaction ID
 * @param {string} status - New status
 * @param {Object} transaction - Database transaction instance
 * @returns {Object} Result
 */
const updateTransactionStatus = async (transactionId, status, dbTransaction = null) => {
  try {
    await GameTransaction.update(
      { 
        status,
        updated_at: new Date()
      },
      {
        where: { transaction_id: transactionId },
        transaction: dbTransaction
      }
    );
    
    return {
      success: true,
      message: 'Transaction status updated'
    };
  } catch (error) {
    console.error('Error updating transaction status:', error);
    return {
      success: false,
      message: 'Failed to update transaction status'
    };
  }
};

/**
 * Process a bet transaction (withdraw)
 * @param {Object} data - Transaction data
 * @returns {Object} Result with transaction and balance info
 */
const processBetTransaction = async (data) => {
  const t = await sequelize.transaction();
  
  try {
    // Check if transaction already exists
    const existingTx = await findTransactionByProviderTxId(data.provider_tx_id);
    if (existingTx.success) {
      await t.rollback();
      return {
        success: true,
        isDuplicate: true,
        transaction: existingTx.transaction
      };
    }
    
    // Get user with locking
    const user = await User.findByPk(data.user_id, {
      lock: true,
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        success: false,
        message: 'User not found'
      };
    }
    
    // Check sufficient balance
    if (parseFloat(user.wallet_balance) < parseFloat(data.amount)) {
      await t.rollback();
      return {
        success: false,
        message: 'Insufficient balance',
        code: 402
      };
    }
    
    // Store old balance
    const oldBalance = parseFloat(user.wallet_balance);
    
    // Update wallet balance
    const newBalance = oldBalance - parseFloat(data.amount);
    await User.update(
      { wallet_balance: newBalance },
      { 
        where: { user_id: data.user_id },
        transaction: t
      }
    );
    
    // Create transaction record
    const txResult = await createGameTransaction({
      ...data,
      type: 'bet',
      status: 'completed'
    }, t);
    
    if (!txResult.success) {
      await t.rollback();
      return txResult;
    }
    
    // Commit transaction
    await t.commit();
    
    return {
      success: true,
      transaction: txResult.transaction,
      operator_tx_id: txResult.operator_tx_id,
      oldBalance,
      newBalance
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing bet transaction:', error);
    return {
      success: false,
      message: 'Failed to process bet transaction'
    };
  }
};

/**
 * Process a win transaction (deposit)
 * @param {Object} data - Transaction data
 * @returns {Object} Result with transaction and balance info
 */
const processWinTransaction = async (data) => {
  const t = await sequelize.transaction();
  
  try {
    // Check if transaction already exists
    const existingTx = await findTransactionByProviderTxId(data.provider_tx_id);
    if (existingTx.success) {
      await t.rollback();
      return {
        success: true,
        isDuplicate: true,
        transaction: existingTx.transaction
      };
    }
    
    // Get user with locking
    const user = await User.findByPk(data.user_id, {
      lock: true,
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        success: false,
        message: 'User not found'
      };
    }
    
    // Store old balance
    const oldBalance = parseFloat(user.wallet_balance);
    
    // Update wallet balance
    const newBalance = oldBalance + parseFloat(data.amount);
    await User.update(
      { wallet_balance: newBalance },
      { 
        where: { user_id: data.user_id },
        transaction: t
      }
    );
    
    // Create transaction record
    const txResult = await createGameTransaction({
      ...data,
      type: 'win',
      status: 'completed',
      related_tx_id: data.withdraw_provider_tx_id
    }, t);
    
    if (!txResult.success) {
      await t.rollback();
      return txResult;
    }
    
    // Commit transaction
    await t.commit();
    
    return {
      success: true,
      transaction: txResult.transaction,
      operator_tx_id: txResult.operator_tx_id,
      oldBalance,
      newBalance
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing win transaction:', error);
    return {
      success: false,
      message: 'Failed to process win transaction'
    };
  }
};

/**
 * Process a rollback transaction
 * @param {Object} data - Transaction data
 * @returns {Object} Result with transaction and balance info
 */
const processRollbackTransaction = async (data) => {
  const t = await sequelize.transaction();
  
  try {
    // Check if transaction already exists
    const existingTx = await findTransactionByProviderTxId(data.provider_tx_id);
    if (existingTx.success) {
      await t.rollback();
      return {
        success: true,
        isDuplicate: true,
        transaction: existingTx.transaction
      };
    }
    
    // Find original transaction to rollback
    const originalTx = await findTransactionByProviderTxId(data.rollback_provider_tx_id);
    
    if (!originalTx.success) {
      await t.rollback();
      return {
        success: false,
        message: 'Original transaction not found',
        code: 408
      };
    }
    
    // Get user with locking
    const user = await User.findByPk(data.user_id, {
      lock: true,
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        success: false,
        message: 'User not found'
      };
    }
    
    // Store old balance
    const oldBalance = parseFloat(user.wallet_balance);
    
    // Calculate new balance based on original transaction type
    let newBalance = oldBalance;
    if (originalTx.transaction.type === 'bet') {
      // Refund bet amount
      newBalance += parseFloat(originalTx.transaction.amount);
    } else if (originalTx.transaction.type === 'win') {
      // Reverse win amount
      newBalance -= parseFloat(originalTx.transaction.amount);
      
      // Prevent negative balance
      if (newBalance < 0) {
        await t.rollback();
        return {
          success: false,
          message: 'Insufficient balance for win rollback',
          code: 402
        };
      }
    }
    
    // Update wallet balance
    await User.update(
      { wallet_balance: newBalance },
      { 
        where: { user_id: data.user_id },
        transaction: t
      }
    );
    
    // Update original transaction status
    await updateTransactionStatus(
      originalTx.transaction.transaction_id, 
      'rolled_back', 
      t
    );
    
    // Create rollback transaction record
    const txResult = await createGameTransaction({
      ...data,
      type: 'rollback',
      status: 'completed',
      related_tx_id: data.rollback_provider_tx_id
    }, t);
    
    if (!txResult.success) {
      await t.rollback();
      return txResult;
    }
    
    // Commit transaction
    await t.commit();
    
    return {
      success: true,
      transaction: txResult.transaction,
      operator_tx_id: txResult.operator_tx_id,
      oldBalance,
      newBalance
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing rollback transaction:', error);
    return {
      success: false,
      message: 'Failed to process rollback transaction'
    };
  }
};

module.exports = {
  createGameSession,
  updateGameSession,
  endGameSession,
  createGameTransaction,
  findTransactionByProviderTxId,
  updateTransactionStatus,
  processBetTransaction,
  processWinTransaction,
  processRollbackTransaction
};
