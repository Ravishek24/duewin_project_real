// Backend/models/index.js - FIXED VERSION WITHOUT DUPLICATE ASSOCIATIONS
'use strict';

const fs = require('fs');
const path = require('path');

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
                // Class-based model with static init method
                if (typeof model.init === 'function') {
                    // Call the static init method on the class
                    const initializedModel = model.init(sequelize);
                    verifyModelMethods(initializedModel, modelName);
                    return initializedModel;
                } else {
                    // Class-based model without static init - call as constructor
                    const initializedModel = new model();
                    verifyModelMethods(initializedModel, modelName);
                    return initializedModel;
                }
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
            const { getSequelizeInstance, waitForDatabase } = require('../config/db');

            // Wait for database to be ready
            await waitForDatabase();

            // Get the sequelize instance
            const sequelize = await getSequelizeInstance();

            // Attach sequelize to models for external access
            models.sequelize = sequelize;

            // Import all model files
            const modelFiles = [
                // Core User & Authentication
                'User',
                'RefreshToken',
                'UserSession',
                'SystemConfig',
                'Announcement',
                'Feedback',

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
                'RebateTeam',

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

                // Add these for 5D logic
                'GameCombinations5D',
                'Game5DSummaryStats',
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

            // 🔥 FIXED: Set up model associations properly without duplicates
            console.log('🔧 Setting up model associations...');
            
            // First, set up individual model associations
            Object.values(models).forEach(model => {
                if (model.associate) {
                    try {
                        model.associate(models);
                    } catch (error) {
                        console.error(`❌ Error setting up associations for model:`, error);
                    }
                }
            });

            // 🔥 FIXED: Set up SPRIBE-specific associations separately with unique aliases
            console.log('🎮 Setting up SPRIBE model associations...');

            try {
                // SpribeGameSession associations
                if (models.SpribeGameSession && models.User) {
                    // Check if association already exists
                    if (!models.SpribeGameSession.associations.user) {
                        models.SpribeGameSession.belongsTo(models.User, {
                            foreignKey: 'user_id',
                            as: 'user' // Use 'user' instead of 'spribeUser'
                        });
                        console.log('✅ SpribeGameSession -> User association created');
                    }
                }

                if (models.SpribeGameSession && models.SpribeTransaction) {
                    // Check if association already exists
                    if (!models.SpribeGameSession.associations.transactions) {
                        models.SpribeGameSession.hasMany(models.SpribeTransaction, {
                            foreignKey: 'session_id',
                            as: 'transactions' // Use 'transactions' instead of 'spribeTransactions'
                        });
                        console.log('✅ SpribeGameSession -> SpribeTransaction association created');
                    }
                }

                // SpribeTransaction associations  
                if (models.SpribeTransaction && models.User) {
                    // Check if association already exists
                    if (!models.SpribeTransaction.associations.user) {
                        models.SpribeTransaction.belongsTo(models.User, {
                            foreignKey: 'user_id',
                            as: 'user' // Use 'user' instead of 'spribeTransactionUser'
                        });
                        console.log('✅ SpribeTransaction -> User association created');
                    }
                }

                if (models.SpribeTransaction && models.SpribeGameSession) {
                    // Check if association already exists
                    if (!models.SpribeTransaction.associations.session) {
                        models.SpribeTransaction.belongsTo(models.SpribeGameSession, {
                            foreignKey: 'session_id',
                            as: 'session' // Use 'session' instead of 'spribeGameSession'
                        });
                        console.log('✅ SpribeTransaction -> SpribeGameSession association created');
                    }
                }

                // 🔥 FIXED: User associations with SPRIBE models - DO NOT CREATE DUPLICATES
                // These should be handled in the User model's associate method, not here
                // Commenting out to prevent duplicates:
                
                /*
                if (models.User && models.SpribeGameSession) {
                    if (!models.User.associations.spribeGameSessions) {
                        models.User.hasMany(models.SpribeGameSession, {
                            foreignKey: 'user_id',
                            as: 'spribeGameSessions'
                        });
                        console.log('✅ User -> SpribeGameSession association created');
                    }
                }

                if (models.User && models.SpribeTransaction) {
                    if (!models.User.associations.spribeTransactions) {
                        models.User.hasMany(models.SpribeTransaction, {
                            foreignKey: 'user_id', 
                            as: 'spribeTransactions'
                        });
                        console.log('✅ User -> SpribeTransaction association created');
                    }
                }
                */

                console.log('✅ All SPRIBE model associations set up successfully');

            } catch (error) {
                console.error('❌ Error setting up SPRIBE associations:', error);
                // Don't throw - continue with initialization
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
    
    // Check associations - use simplified aliases
    if (models.SpribeGameSession && !models.SpribeGameSession.associations.user) {
        issues.push('SpribeGameSession -> User association missing');
    }
    
    if (models.SpribeGameSession && !models.SpribeGameSession.associations.transactions) {
        issues.push('SpribeGameSession -> SpribeTransaction association missing');
    }
    
    if (models.SpribeTransaction && !models.SpribeTransaction.associations.user) {
        issues.push('SpribeTransaction -> User association missing');
    }
    
    if (models.SpribeTransaction && !models.SpribeTransaction.associations.session) {
        issues.push('SpribeTransaction -> SpribeGameSession association missing');
    }
    
    return {
        success: issues.length === 0,
        issues: issues,
        message: issues.length === 0 ? 'All SPRIBE models and associations verified' : `Found ${issues.length} issues`
    };
};

// Export models and functions
module.exports = {
    initializeModels,
    getModels,
    getModelsSync,
    getSpribeModels,
    verifySpribeModels,
    // Add this getter only if you need backward compatibility
    get models() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models;
    },
    // Add individual model exports for backward compatibility
    get User() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.User;
    },
    get Transaction() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.Transaction;
    },
    get Announcement() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.Announcement;
    },
    get Feedback() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.Feedback;
    },
    get SpribeGameSession() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.SpribeGameSession;
    },
    get UserRebateLevel() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.UserRebateLevel;
    },
    get RebateLevel() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.RebateLevel;
    },
    get VipLevel() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.VipLevel;
    },
    get VipReward() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.VipReward;
    },
    get RebateTeam() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.RebateTeam;
    },
    get GameSession() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.GameSession;
    },
    get WalletRecharge() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.WalletRecharge;
    },
    get RateLimitViolation() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.RateLimitViolation;
    },
    get GameTransaction() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.GameTransaction;
    },
    get Game() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.Game;
    },
    get BetRecordWingo() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.BetRecordWingo;
    },
    get BetRecord5D() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.BetRecord5D;
    },
    get BetRecordK3() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.BetRecordK3;
    },
    get BetRecordTrxWix() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.BetRecordTrxWix;
    },
    get WalletWithdrawal() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.WalletWithdrawal;
    },
    get GameCombinations5D() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.GameCombinations5D;
    },
    get Game5DSummaryStats() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models.Game5DSummaryStats;
    },
};