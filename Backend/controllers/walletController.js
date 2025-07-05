const { 
    getWalletBalance, 
    getTransactionHistory, 
    getRechargeHistory,
    getWithdrawalHistory,
    processWithdrawal
} = require('../services/walletServices');
const User = require('../models/User');

// Controller to get user's wallet balance
const getWalletBalanceController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await getWalletBalance(userId);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(404).json(result);
        }
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching wallet balance.' 
        });
    }
};

// Controller to get user's transaction history
const getTransactionHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10 } = req.query;
        
        const result = await getTransactionHistory(userId, parseInt(page), parseInt(limit));
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching transaction history.' 
        });
    }
};

// Controller to get user's deposit history
const getDepositHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10 } = req.query;
        
        const result = await getRechargeHistory(userId, parseInt(page), parseInt(limit));
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error fetching deposit history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching deposit history.' 
        });
    }
};

// Controller to get user's withdrawal history
const getWithdrawalHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10 } = req.query;
        
        const result = await getWithdrawalHistory(userId, parseInt(page), parseInt(limit));
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error fetching withdrawal history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching withdrawal history.' 
        });
    }
};

// Controller to check first recharge bonus status
const getFirstBonusStatusController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const user = await User.findByPk(userId, {
            attributes: ['has_received_first_bonus', 'actual_deposit_amount']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        return res.status(200).json({
            success: true,
            hasReceivedFirstBonus: user.has_received_first_bonus,
            actualDepositAmount: parseFloat(user.actual_deposit_amount)
        });
    } catch (error) {
        console.error('Error checking first bonus status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error checking first bonus status.' 
        });
    }
};

// Controller to initiate withdrawal
const initiateWithdrawalController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { amount, bank_account_id, usdt_account_id, withdrawal_type = 'BANK' } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount provided'
            });
        }

        if (withdrawal_type === 'BANK') {
            if (!bank_account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Bank account ID is required'
                });
            }
        } else if (withdrawal_type === 'USDT') {
            if (!usdt_account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'USDT account ID is required'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid withdrawal type'
            });
        }

        // Generate unique order ID
        const orderId = `WD${Date.now()}${userId}`;

        // Add background withdrawal processing job
        const withdrawalQueue = require('../queues/withdrawalQueue');
        
        // Job 1: Process withdrawal (immediate validation and processing)
        withdrawalQueue.add('processWithdrawal', {
            userId: userId,
            amount: amount,
            orderId: orderId,
            withdrawalType: withdrawal_type,
            bankAccountId: bank_account_id,
            usdtAccountId: usdt_account_id
        }, {
            priority: 10,
            removeOnComplete: 5,
            removeOnFail: 10,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 }
        }).catch(console.error);
        
        // Job 2: Send admin notification (delayed)
        const adminQueue = require('../queues/adminQueue');
        adminQueue.add('notifyAdmin', {
            type: 'withdrawal_request',
            userId: userId,
            amount: amount,
            withdrawalType: withdrawal_type,
            orderId: orderId
        }, {
            delay: 5000, // Notify admin after 5 seconds
            priority: 5,
            attempts: 2
        }).catch(console.error);

        // Return immediate response
        return res.status(200).json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            data: {
                orderId: orderId,
                amount: amount,
                status: 'pending',
                withdrawalType: withdrawal_type,
                estimatedProcessingTime: '24-48 hours',
                note: 'Your withdrawal request has been submitted and is pending admin approval.'
            }
        });

    } catch (error) {
        console.error('Error initiating withdrawal:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error initiating withdrawal'
        });
    }
};

/**
 * Get both main wallet and third-party wallet balances
 * @param {Object} req - Express request object 
 * @param {Object} res - Express response object
 */
const getAllWalletBalances = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get main wallet balance from user table
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get third-party wallet balance
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    const thirdPartyWallet = await thirdPartyWalletService.getBalance(userId);
    
    return res.status(200).json({
      success: true,
      mainWallet: {
        balance: parseFloat(user.wallet_balance),
        currency: user.currency || 'EUR'
      },
      thirdPartyWallet: {
        balance: thirdPartyWallet.success ? parseFloat(thirdPartyWallet.balance) : 0,
        currency: thirdPartyWallet.success ? thirdPartyWallet.currency : 'EUR',
        exists: thirdPartyWallet.success
      }
    });
  } catch (error) {
    console.error('Error getting all wallet balances:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching wallet balances'
    });
  }
};

/**
 * Force transfer all funds from third-party wallet to main wallet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const transferFromThirdPartyToMain = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Import third-party wallet service
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    
    // Perform the transfer
    const result = await thirdPartyWalletService.transferToMainWallet(userId);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Funds transferred successfully from third-party wallet to main wallet',
        ...result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to transfer funds'
      });
    }
  } catch (error) {
    console.error('Error transferring from third-party to main wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Server error transferring funds'
    });
  }
};

// Controller to get seamless slot game history
const getSeamlessSlotHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 20, provider, gameId, startDate, endDate, type } = req.query;
        
        // Import the service
        const { getSeamlessTransactionHistory } = require('../services/walletServices');
        
        // Build where clause for filtering
        let whereClause = { user_id: userId };
        
        if (provider) {
            whereClause.provider = provider;
        }
        
        if (gameId) {
            whereClause.game_id = gameId;
        }
        
        if (type) {
            whereClause.type = type;
        }
        
        if (startDate || endDate) {
            whereClause.created_at = {};
            if (startDate) {
                whereClause.created_at.$gte = new Date(startDate);
            }
            if (endDate) {
                whereClause.created_at.$lte = new Date(endDate);
            }
        }
        
        // Get transactions with enhanced processing
        const SeamlessTransaction = require('../models/SeamlessTransaction');
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count
        const total = await SeamlessTransaction.count({
            where: whereClause
        });
        
        // Get transactions with pagination
        const transactions = await SeamlessTransaction.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            include: [
                {
                    model: require('../models/User'),
                    as: 'seamlesstransactionuser',
                    attributes: ['user_name', 'user_id']
                }
            ]
        });
        
        // Process transactions to calculate profit/loss and format data
        const processedTransactions = transactions.map(transaction => {
            const amount = parseFloat(transaction.amount);
            const isBet = transaction.type === 'debit';
            const isWin = transaction.type === 'credit';
            
            // Calculate profit/loss
            let profitLoss = 0;
            if (isBet) {
                profitLoss = -amount; // Negative for bets
            } else if (isWin) {
                profitLoss = amount; // Positive for wins
            }
            
            return {
                order_no: transaction.transaction_id,
                provider: transaction.provider,
                game_id: transaction.game_id,
                game_id_hash: transaction.game_id_hash,
                round_id: transaction.round_id,
                type: transaction.type,
                total_bet: isBet ? amount : 0,
                winnings: isWin ? amount : 0,
                profit_loss: profitLoss,
                profit_loss_formatted: profitLoss >= 0 ? `+${profitLoss.toFixed(2)}` : `${profitLoss.toFixed(2)}`,
                balance_before: parseFloat(transaction.wallet_balance_before || 0),
                balance_after: parseFloat(transaction.wallet_balance_after || 0),
                is_freeround_bet: transaction.is_freeround_bet,
                is_freeround_win: transaction.is_freeround_win,
                is_jackpot_win: transaction.is_jackpot_win,
                jackpot_contribution: parseFloat(transaction.jackpot_contribution_in_amount || 0),
                status: transaction.status,
                created_at: transaction.created_at,
                updated_at: transaction.updated_at
            };
        });
        
        // Calculate summary statistics
        const summary = {
            total_transactions: total,
            total_bets: processedTransactions.filter(t => t.type === 'debit').length,
            total_wins: processedTransactions.filter(t => t.type === 'credit').length,
            total_bet_amount: processedTransactions
                .filter(t => t.type === 'debit')
                .reduce((sum, t) => sum + t.total_bet, 0),
            total_winnings: processedTransactions
                .filter(t => t.type === 'credit')
                .reduce((sum, t) => sum + t.winnings, 0),
            net_profit_loss: processedTransactions
                .reduce((sum, t) => sum + t.profit_loss, 0),
            net_profit_loss_formatted: processedTransactions
                .reduce((sum, t) => sum + t.profit_loss, 0) >= 0 
                ? `+${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
                : `${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
        };
        
        // Group by provider for additional insights
        const providerStats = {};
        processedTransactions.forEach(transaction => {
            if (!providerStats[transaction.provider]) {
                providerStats[transaction.provider] = {
                    total_bets: 0,
                    total_wins: 0,
                    total_bet_amount: 0,
                    total_winnings: 0,
                    net_profit_loss: 0
                };
            }
            
            if (transaction.type === 'debit') {
                providerStats[transaction.provider].total_bets++;
                providerStats[transaction.provider].total_bet_amount += transaction.total_bet;
                providerStats[transaction.provider].net_profit_loss -= transaction.total_bet;
            } else if (transaction.type === 'credit') {
                providerStats[transaction.provider].total_wins++;
                providerStats[transaction.provider].total_winnings += transaction.winnings;
                providerStats[transaction.provider].net_profit_loss += transaction.winnings;
            }
        });
        
        return res.status(200).json({
            success: true,
            data: {
                transactions: processedTransactions,
                summary: summary,
                provider_stats: providerStats,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(total / parseInt(limit)),
                    total_records: total,
                    limit: parseInt(limit),
                    has_next_page: parseInt(page) < Math.ceil(total / parseInt(limit)),
                    has_prev_page: parseInt(page) > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching seamless slot history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching seamless slot history.' 
        });
    }
};

// Controller to get live casino game history
const getLiveCasinoHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 20, provider, gameId, startDate, endDate, type } = req.query;
        
        // Import the service
        const { getSeamlessTransactionHistory } = require('../services/walletServices');
        
        // Build where clause for filtering - focus on live casino providers
        let whereClause = { user_id: userId };
        
        // Live casino providers (these are the main live casino providers)
        const liveCasinoProviders = ['BombayLive', 'es', 'ev', 'ag', 'vg', 'ez', 'ol', 'bl'];
        
        if (provider) {
            if (liveCasinoProviders.includes(provider)) {
                whereClause.provider = provider;
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid provider for live casino. Valid providers: BombayLive, es, ev, ag, vg, ez, ol, bl'
                });
            }
        } else {
            // If no specific provider, filter by live casino providers
            whereClause.provider = { [require('sequelize').Op.in]: liveCasinoProviders };
        }
        
        if (gameId) {
            whereClause.game_id = gameId;
        }
        
        if (type) {
            whereClause.type = type;
        }
        
        if (startDate || endDate) {
            whereClause.created_at = {};
            if (startDate) {
                whereClause.created_at.$gte = new Date(startDate);
            }
            if (endDate) {
                whereClause.created_at.$lte = new Date(endDate);
            }
        }
        
        // Get transactions with enhanced processing
        const SeamlessTransaction = require('../models/SeamlessTransaction');
        const { Op } = require('sequelize');
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count
        const total = await SeamlessTransaction.count({
            where: whereClause
        });
        
        // Get transactions with pagination
        const transactions = await SeamlessTransaction.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            include: [
                {
                    model: require('../models/User'),
                    as: 'seamlesstransactionuser',
                    attributes: ['user_name', 'user_id']
                }
            ]
        });
        
        // Process transactions to calculate profit/loss and format data
        const processedTransactions = transactions.map(transaction => {
            const amount = parseFloat(transaction.amount);
            const isBet = transaction.type === 'debit';
            const isWin = transaction.type === 'credit';
            
            // Calculate profit/loss
            let profitLoss = 0;
            if (isBet) {
                profitLoss = -amount; // Negative for bets
            } else if (isWin) {
                profitLoss = amount; // Positive for wins
            }
            
            return {
                order_no: transaction.transaction_id,
                provider: transaction.provider,
                game_id: transaction.game_id,
                game_id_hash: transaction.game_id_hash,
                round_id: transaction.round_id,
                type: transaction.type,
                total_bet: isBet ? amount : 0,
                winnings: isWin ? amount : 0,
                profit_loss: profitLoss,
                profit_loss_formatted: profitLoss >= 0 ? `+${profitLoss.toFixed(2)}` : `${profitLoss.toFixed(2)}`,
                balance_before: parseFloat(transaction.wallet_balance_before || 0),
                balance_after: parseFloat(transaction.wallet_balance_after || 0),
                is_freeround_bet: transaction.is_freeround_bet,
                is_freeround_win: transaction.is_freeround_win,
                is_jackpot_win: transaction.is_jackpot_win,
                jackpot_contribution: parseFloat(transaction.jackpot_contribution_in_amount || 0),
                status: transaction.status,
                created_at: transaction.created_at,
                updated_at: transaction.updated_at
            };
        });
        
        // Calculate summary statistics
        const summary = {
            game_type: 'live_casino',
            total_transactions: total,
            total_bets: processedTransactions.filter(t => t.type === 'debit').length,
            total_wins: processedTransactions.filter(t => t.type === 'credit').length,
            total_bet_amount: processedTransactions
                .filter(t => t.type === 'debit')
                .reduce((sum, t) => sum + t.total_bet, 0),
            total_winnings: processedTransactions
                .filter(t => t.type === 'credit')
                .reduce((sum, t) => sum + t.winnings, 0),
            net_profit_loss: processedTransactions
                .reduce((sum, t) => sum + t.profit_loss, 0),
            net_profit_loss_formatted: processedTransactions
                .reduce((sum, t) => sum + t.profit_loss, 0) >= 0 
                ? `+${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
                : `${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
        };
        
        // Group by provider for additional insights
        const providerStats = {};
        processedTransactions.forEach(transaction => {
            if (!providerStats[transaction.provider]) {
                providerStats[transaction.provider] = {
                    total_bets: 0,
                    total_wins: 0,
                    total_bet_amount: 0,
                    total_winnings: 0,
                    net_profit_loss: 0
                };
            }
            
            if (transaction.type === 'debit') {
                providerStats[transaction.provider].total_bets++;
                providerStats[transaction.provider].total_bet_amount += transaction.total_bet;
                providerStats[transaction.provider].net_profit_loss -= transaction.total_bet;
            } else if (transaction.type === 'credit') {
                providerStats[transaction.provider].total_wins++;
                providerStats[transaction.provider].total_winnings += transaction.winnings;
                providerStats[transaction.provider].net_profit_loss += transaction.winnings;
            }
        });
        
        return res.status(200).json({
            success: true,
            data: {
                game_type: 'live_casino',
                transactions: processedTransactions,
                summary: summary,
                provider_stats: providerStats,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(total / parseInt(limit)),
                    total_records: total,
                    limit: parseInt(limit),
                    has_next_page: parseInt(page) < Math.ceil(total / parseInt(limit)),
                    has_prev_page: parseInt(page) > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching live casino history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching live casino history.' 
        });
    }
};

// Controller to get sports betting history
const getSportsBettingHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 20, provider, gameId, startDate, endDate, type } = req.query;
        
        // Import the service
        const { getSeamlessTransactionHistory } = require('../services/walletServices');
        
        // Build where clause for filtering - focus on sports betting providers
        let whereClause = { user_id: userId };
        
        // Sports betting providers (these are the main sports betting providers)
        const sportsProviders = ['ds', 'dt', 'g24']; // Delasport, Digitain, G24 are known for sports
        
        if (provider) {
            if (sportsProviders.includes(provider)) {
                whereClause.provider = provider;
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid provider for sports betting. Valid providers: ds, dt, g24'
                });
            }
        } else {
            // If no specific provider, filter by sports providers
            whereClause.provider = { [require('sequelize').Op.in]: sportsProviders };
        }
        
        if (gameId) {
            whereClause.game_id = gameId;
        }
        
        if (type) {
            whereClause.type = type;
        }
        
        if (startDate || endDate) {
            whereClause.created_at = {};
            if (startDate) {
                whereClause.created_at.$gte = new Date(startDate);
            }
            if (endDate) {
                whereClause.created_at.$lte = new Date(endDate);
            }
        }
        
        // Get transactions with enhanced processing
        const SeamlessTransaction = require('../models/SeamlessTransaction');
        const { Op } = require('sequelize');
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count
        const total = await SeamlessTransaction.count({
            where: whereClause
        });
        
        // Get transactions with pagination
        const transactions = await SeamlessTransaction.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            include: [
                {
                    model: require('../models/User'),
                    as: 'seamlesstransactionuser',
                    attributes: ['user_name', 'user_id']
                }
            ]
        });
        
        // Process transactions to calculate profit/loss and format data
        const processedTransactions = transactions.map(transaction => {
            const amount = parseFloat(transaction.amount);
            const isBet = transaction.type === 'debit';
            const isWin = transaction.type === 'credit';
            
            // Calculate profit/loss
            let profitLoss = 0;
            if (isBet) {
                profitLoss = -amount; // Negative for bets
            } else if (isWin) {
                profitLoss = amount; // Positive for wins
            }
            
            return {
                order_no: transaction.transaction_id,
                provider: transaction.provider,
                game_id: transaction.game_id,
                game_id_hash: transaction.game_id_hash,
                round_id: transaction.round_id,
                type: transaction.type,
                total_bet: isBet ? amount : 0,
                winnings: isWin ? amount : 0,
                profit_loss: profitLoss,
                profit_loss_formatted: profitLoss >= 0 ? `+${profitLoss.toFixed(2)}` : `${profitLoss.toFixed(2)}`,
                balance_before: parseFloat(transaction.wallet_balance_before || 0),
                balance_after: parseFloat(transaction.wallet_balance_after || 0),
                is_freeround_bet: transaction.is_freeround_bet,
                is_freeround_win: transaction.is_freeround_win,
                is_jackpot_win: transaction.is_jackpot_win,
                jackpot_contribution: parseFloat(transaction.jackpot_contribution_in_amount || 0),
                status: transaction.status,
                created_at: transaction.created_at,
                updated_at: transaction.updated_at
            };
        });
        
        // Calculate summary statistics
        const summary = {
            game_type: 'sports_betting',
            total_transactions: total,
            total_bets: processedTransactions.filter(t => t.type === 'debit').length,
            total_wins: processedTransactions.filter(t => t.type === 'credit').length,
            total_bet_amount: processedTransactions
                .filter(t => t.type === 'debit')
                .reduce((sum, t) => sum + t.total_bet, 0),
            total_winnings: processedTransactions
                .filter(t => t.type === 'credit')
                .reduce((sum, t) => sum + t.winnings, 0),
            net_profit_loss: processedTransactions
                .reduce((sum, t) => sum + t.profit_loss, 0),
            net_profit_loss_formatted: processedTransactions
                .reduce((sum, t) => sum + t.profit_loss, 0) >= 0 
                ? `+${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
                : `${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
        };
        
        // Group by provider for additional insights
        const providerStats = {};
        processedTransactions.forEach(transaction => {
            if (!providerStats[transaction.provider]) {
                providerStats[transaction.provider] = {
                    total_bets: 0,
                    total_wins: 0,
                    total_bet_amount: 0,
                    total_winnings: 0,
                    net_profit_loss: 0
                };
            }
            
            if (transaction.type === 'debit') {
                providerStats[transaction.provider].total_bets++;
                providerStats[transaction.provider].total_bet_amount += transaction.total_bet;
                providerStats[transaction.provider].net_profit_loss -= transaction.total_bet;
            } else if (transaction.type === 'credit') {
                providerStats[transaction.provider].total_wins++;
                providerStats[transaction.provider].total_winnings += transaction.winnings;
                providerStats[transaction.provider].net_profit_loss += transaction.winnings;
            }
        });
        
        return res.status(200).json({
            success: true,
            data: {
                game_type: 'sports_betting',
                transactions: processedTransactions,
                summary: summary,
                provider_stats: providerStats,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(total / parseInt(limit)),
                    total_records: total,
                    limit: parseInt(limit),
                    has_next_page: parseInt(page) < Math.ceil(total / parseInt(limit)),
                    has_prev_page: parseInt(page) > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching sports betting history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching sports betting history.' 
        });
    }
};

module.exports = {
    getWalletBalanceController,
    getTransactionHistoryController,
    getDepositHistoryController,
    getWithdrawalHistoryController,
    getFirstBonusStatusController,
    initiateWithdrawalController,
    getAllWalletBalances,
    transferFromThirdPartyToMain,
    getSeamlessSlotHistoryController,
    getLiveCasinoHistoryController,
    getSportsBettingHistoryController
};