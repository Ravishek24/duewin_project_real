// Backend/models/index.js - Fixed Version
'use strict';

const fs = require('fs');
const path = require('path');

// DON'T import sequelize at the top level - it will be imported when needed
// const { sequelize, waitForDatabase } = require('../config/db'); // REMOVED

// Helper function to verify model methods
const verifyModelMethods = (model, modelName) => {
    const requiredMethods = ['findOne', 'create', 'update', 'findAll', 'destroy'];
    const missingMethods = requiredMethods.filter(method => typeof model[method] !== 'function');

    if (missingMethods.length > 0) {
        throw new Error(`Model ${modelName} is missing required methods: ${missingMethods.join(', ')}`);
    }
    return true;
};

// Helper function to initialize a single model
const initializeModel = async (modelFile, modelName, sequelize) => {
    try {
        const model = require(modelFile);

        // Handle different model types
        if (typeof model === 'function') {
            if (model.prototype && model.prototype.constructor.name === modelName) {
                // Class-based model
                const initializedModel = model.init(sequelize);
                verifyModelMethods(initializedModel, modelName);
                return initializedModel;
            } else {
                // Function-based model (module.exports = (sequelize, DataTypes) => { ... })
                const initializedModel = model(sequelize, sequelize.constructor.DataTypes);
                verifyModelMethods(initializedModel, modelName);
                return initializedModel;
            }
        } else if (model && typeof model.init === 'function') {
            // Pre-initialized Sequelize model
            const initializedModel = model.init(sequelize);
            verifyModelMethods(initializedModel, modelName);
            return initializedModel;
        } else {
            // Pre-initialized model
            verifyModelMethods(model, modelName);
            return model;
        }
    } catch (error) {
        console.error(`Error initializing model ${modelName}:`, error);
        throw error;
    }
};

// Initialize models variable
let models = {};
let isInitialized = false;
let initializationPromise = null;

/**
 * Initialize all models
 * @returns {Promise<Object>} Initialized models
 */
const initializeModels = async () => {
    // If already initialized, return models
    if (isInitialized) {
        return models;
    }

    // If initialization is in progress, return the existing promise
    if (initializationPromise) {
        return initializationPromise;
    }

    // Start initialization
    initializationPromise = (async () => {
        try {
            console.log('🔄 Initializing models...');

            // Import sequelize AFTER database connection is established
            const { sequelize, waitForDatabase } = require('../config/db');

            // Wait for database to be ready
            await waitForDatabase();

            // Import all model files
            const modelFiles = [
                // Core User & Authentication
                'User',
                'RefreshToken',
                'UserSession',
                'SystemConfig',

                // Game Models
                'GameConfig',
                'GamePeriod',
                'BetResultWingo',
                'BetResult5D',
                'BetResultK3',
                'BetResultTrxWix',
                'BetRecordWingo',
                'BetRecord5D',
                'BetRecordK3',
                'BetRecordTrxWix',
                'GameTransaction',
                'GameSession',
                'SeamlessTransaction',
                'SeamlessGameSession',

                // Spribe Game Models
                'SpribeGameSession',
                'SpribeTransaction',

                // Payment & Wallet Models
                'PaymentGateway',
                'PaymentGatewaySettings',
                'WalletRecharge',
                'WalletWithdrawal',
                'WithdrawalAdmin',
                'BankAccount',
                'UsdtAccount',
                'ThirdPartyWallet',
                'Transaction',

                // Referral System Models
                'ReferralTree',
                'ReferralCommission',
                'ValidReferral',

                // VIP & Rebate Models  
                'VipLevel',
                'VipReward',
                'VipExperienceHistory',
                'RebateLevel',
                'UserRebateLevel',

                // Attendance & Bonus Models
                'AttendanceRecord',

                // Rate Limiting & Security
                'RateLimitViolation',

                // OTP & Requests
                'OtpRequest',

                // Gift System
                'GiftCode',
                'GiftCodeClaim',

                'UserVault',
                'VaultTransaction', 
                'ActivityReward',
                'SelfRebate',

            ];

            // Initialize each model
            for (const modelName of modelFiles) {
                try {
                    models[modelName] = await initializeModel(`./${modelName}`, modelName, sequelize);
                    console.log(`✅ Initialized model: ${modelName}`);
                } catch (error) {
                    console.error(`❌ Error initializing model ${modelName}:`, error);
                    // Don't throw error for individual models - continue with others
                    console.warn(`⚠️ Skipping model ${modelName} due to error`);
                }
            }

            // Set up model associations
            Object.values(models).forEach(model => {
                if (model.associate) {
                    try {
                        model.associate(models);
                    } catch (error) {
                        console.error(`❌ Error setting up associations for model:`, error);
                    }
                }
            });

            // ======================= SPRIBE MODEL ASSOCIATIONS =======================

            // Set up SPRIBE-specific associations
            console.log('🎮 Setting up SPRIBE model associations...');

            try {
                // SpribeGameSession associations
                if (models.SpribeGameSession && models.User) {
                    models.SpribeGameSession.belongsTo(models.User, {
                        foreignKey: 'user_id',
                        as: 'spribeUser'
                    });
                    console.log('✅ SpribeGameSession -> User association created');
                }

                if (models.SpribeGameSession && models.SpribeTransaction) {
                    models.SpribeGameSession.hasMany(models.SpribeTransaction, {
                        foreignKey: 'session_id',
                        as: 'spribeTransactions'
                    });
                    console.log('✅ SpribeGameSession -> SpribeTransaction association created');
                }

                // SpribeTransaction associations  
                if (models.SpribeTransaction && models.User) {
                    models.SpribeTransaction.belongsTo(models.User, {
                        foreignKey: 'user_id',
                        as: 'spribeTransactionUser'
                    });
                    console.log('✅ SpribeTransaction -> User association created');
                }

                if (models.SpribeTransaction && models.SpribeGameSession) {
                    models.SpribeTransaction.belongsTo(models.SpribeGameSession, {
                        foreignKey: 'session_id',
                        as: 'spribeGameSession'
                    });
                    console.log('✅ SpribeTransaction -> SpribeGameSession association created');
                }

                // User associations with SPRIBE models
                if (models.User && models.SpribeGameSession) {
                    models.User.hasMany(models.SpribeGameSession, {
                        foreignKey: 'user_id',
                        as: 'spribeGameSessions'
                    });
                    console.log('✅ User -> SpribeGameSession association created');
                }

                if (models.User && models.SpribeTransaction) {
                    models.User.hasMany(models.SpribeTransaction, {
                        foreignKey: 'user_id', 
                        as: 'spribeTransactions'
                    });
                    console.log('✅ User -> SpribeTransaction association created');
                }

                console.log('✅ All SPRIBE model associations set up successfully');

            } catch (error) {
                console.error('❌ Error setting up SPRIBE associations:', error);
            }

            isInitialized = true;
            console.log('✅ All models initialized successfully');
            console.log(`📊 Successfully loaded ${Object.keys(models).length} models`);
            return models;
        } catch (error) {
            console.error('❌ Error during model initialization:', error);
            isInitialized = false;
            initializationPromise = null;
            throw error;
        }
    })();

    return initializationPromise;
};

/**
 * Get initialized models
 * @returns {Promise<Object>} Initialized models
 */
const getModels = async () => {
    if (!isInitialized) {
        return await initializeModels();
    }
    return models;
};

/**
 * Get models synchronously (throws error if not initialized)
 * @returns {Object} Initialized models
 */
const getModelsSync = () => {
    if (!isInitialized) {
        throw new Error('Models not initialized. Call initializeModels() first.');
    }
    return models;
};

/**
 * Get SPRIBE models specifically
 * @returns {Object} SPRIBE models
 */
const getSpribeModels = () => {
    if (!isInitialized) {
        throw new Error('Models not initialized. Call initializeModels() first.');
    }
    
    return {
        SpribeGameSession: models.SpribeGameSession,
        SpribeTransaction: models.SpribeTransaction,
        User: models.User // Include User for convenience
    };
};

/**
 * Verify SPRIBE models are properly loaded
 * @returns {Object} Verification result
 */
const verifySpribeModels = () => {
    const issues = [];
    
    if (!models.SpribeGameSession) {
        issues.push('SpribeGameSession model not loaded');
    }
    
    if (!models.SpribeTransaction) {
        issues.push('SpribeTransaction model not loaded');
    }
    
    if (!models.User) {
        issues.push('User model not loaded');
    }
    
    // Check associations
    if (models.SpribeGameSession && !models.SpribeGameSession.associations.spribeUser) {
        issues.push('SpribeGameSession -> User association missing');
    }
    
    if (models.SpribeGameSession && !models.SpribeGameSession.associations.spribeTransactions) {
        issues.push('SpribeGameSession -> SpribeTransaction association missing');
    }
    
    if (models.SpribeTransaction && !models.SpribeTransaction.associations.spribeTransactionUser) {
        issues.push('SpribeTransaction -> User association missing');
    }
    
    if (models.SpribeTransaction && !models.SpribeTransaction.associations.spribeGameSession) {
        issues.push('SpribeTransaction -> SpribeGameSession association missing');
    }
    
    return {
        success: issues.length === 0,
        issues: issues,
        message: issues.length === 0 ? 'All SPRIBE models and associations verified' : `Found ${issues.length} issues`
    };
};

/**
 * Get SPRIBE transaction statistics
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Statistics
 */
const getSpribeStatistics = async (filters = {}) => {
    try {
        if (!isInitialized) {
            throw new Error('Models not initialized');
        }
        
        const { sequelize } = require('../config/db');
        const { Op } = require('sequelize');
        
        const {
            userId,
            gameId,
            dateFrom,
            dateTo,
            currency = 'EUR'
        } = filters;
        
        let whereClause = {};
        
        if (userId) {
            whereClause.user_id = userId;
        }
        
        if (gameId) {
            whereClause.game_id = gameId;
        }
        
        if (currency) {
            whereClause.currency = currency;
        }
        
        if (dateFrom || dateTo) {
            whereClause.created_at = {};
            if (dateFrom) {
                whereClause.created_at[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                whereClause.created_at[Op.lte] = new Date(dateTo);
            }
        }
        
        // Get transaction statistics
        const stats = await models.SpribeTransaction.findAll({
            where: whereClause,
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_transactions'],
                [sequelize.fn('COUNT', sequelize.literal("CASE WHEN type = 'bet' THEN 1 END")), 'total_bets'],
                [sequelize.fn('COUNT', sequelize.literal("CASE WHEN type = 'win' THEN 1 END")), 'total_wins'],
                [sequelize.fn('COUNT', sequelize.literal("CASE WHEN type = 'rollback' THEN 1 END")), 'total_rollbacks'],
                [sequelize.fn('SUM', sequelize.literal("CASE WHEN type = 'bet' THEN amount ELSE 0 END")), 'total_bet_amount'],
                [sequelize.fn('SUM', sequelize.literal("CASE WHEN type = 'win' THEN amount ELSE 0 END")), 'total_win_amount'],
                [sequelize.fn('AVG', sequelize.literal("CASE WHEN type = 'bet' THEN amount END")), 'avg_bet_amount'],
                [sequelize.fn('MAX', sequelize.literal("CASE WHEN type = 'bet' THEN amount END")), 'max_bet_amount'],
                [sequelize.fn('MAX', sequelize.literal("CASE WHEN type = 'win' THEN amount END")), 'max_win_amount']
            ],
            raw: true
        });
        
        // Get session statistics
        let sessionStats = {};
        if (userId) {
            const sessions = await models.SpribeGameSession.findAll({
                where: userId ? { user_id: userId } : {},
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_sessions'],
                    [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'active' THEN 1 END")), 'active_sessions'],
                    [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'ended' THEN 1 END")), 'completed_sessions'],
                    [sequelize.fn('AVG', sequelize.literal("CASE WHEN ended_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, started_at, ended_at) END")), 'avg_session_duration']
                ],
                raw: true
            });
            
            sessionStats = sessions[0] || {};
        }
        
        const transactionStats = stats[0] || {};
        
        // Calculate derived statistics
        const totalBetAmount = parseInt(transactionStats.total_bet_amount) || 0;
        const totalWinAmount = parseInt(transactionStats.total_win_amount) || 0;
        const netResult = totalWinAmount - totalBetAmount;
        const rtp = totalBetAmount > 0 ? (totalWinAmount / totalBetAmount * 100) : 0;
        
        return {
            success: true,
            currency: currency,
            transactions: {
                total: parseInt(transactionStats.total_transactions) || 0,
                bets: parseInt(transactionStats.total_bets) || 0,
                wins: parseInt(transactionStats.total_wins) || 0,
                rollbacks: parseInt(transactionStats.total_rollbacks) || 0
            },
            amounts: {
                total_bet: (totalBetAmount / 100).toFixed(2),
                total_win: (totalWinAmount / 100).toFixed(2),
                net_result: (netResult / 100).toFixed(2),
                avg_bet: ((parseInt(transactionStats.avg_bet_amount) || 0) / 100).toFixed(2),
                max_bet: ((parseInt(transactionStats.max_bet_amount) || 0) / 100).toFixed(2),
                max_win: ((parseInt(transactionStats.max_win_amount) || 0) / 100).toFixed(2)
            },
            metrics: {
                rtp_percentage: rtp.toFixed(2),
                win_rate: transactionStats.total_bets > 0 ? 
                    ((parseInt(transactionStats.total_wins) || 0) / (parseInt(transactionStats.total_bets) || 1) * 100).toFixed(2) : '0.00'
            },
            sessions: {
                total: parseInt(sessionStats.total_sessions) || 0,
                active: parseInt(sessionStats.active_sessions) || 0,
                completed: parseInt(sessionStats.completed_sessions) || 0,
                avg_duration_minutes: sessionStats.avg_session_duration ? 
                    (parseFloat(sessionStats.avg_session_duration) / 60).toFixed(2) : '0.00'
            }
        };
        
    } catch (error) {
        console.error('❌ Error getting SPRIBE statistics:', error);
        return {
            success: false,
            message: 'Failed to get statistics',
            error: error.message
        };
    }
};

// Export models and functions
module.exports = {
    initializeModels,
    getModels,
    getModelsSync,
    getSpribeModels,
    verifySpribeModels,
    getSpribeStatistics,
    // Add this getter only if you need backward compatibility
    get models() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models;
    }
};