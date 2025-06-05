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

// Export models and functions
module.exports = {
    initializeModels,
    getModels,
    getModelsSync,
    // Add this getter only if you need backward compatibility
    get models() {
        if (!isInitialized) {
            throw new Error('Models not initialized. Call initializeModels() first.');
        }
        return models;
    }
};