// Backend/models/index.js - Fixed Version
'use strict';

const fs = require('fs');
const path = require('path');
const { sequelize, waitForDatabase } = require('../config/db');

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
const initializeModel = async (modelFile, modelName) => {
    try {
        const model = require(modelFile);

        // Handle different model types
        if (typeof model === 'function') {
            if (model.prototype && model.prototype.constructor.name === modelName) {
                // Class-based model
                if (typeof model.init === 'function') {
                    // Initialize the model class first
                    const initializedModel = model.init(sequelize, sequelize.constructor.DataTypes);
                    verifyModelMethods(initializedModel, modelName);
                    return initializedModel;
                } else {
                    throw new Error(`Class-based model ${modelName} is missing static init method`);
                }
            } else {
                // Function-based model (module.exports = (sequelize, DataTypes) => { ... })
                const initializedModel = model(sequelize, sequelize.constructor.DataTypes);
                verifyModelMethods(initializedModel, modelName);
                return initializedModel;
            }
        } else if (model && typeof model.init === 'function') {
            // Pre-initialized Sequelize model
            const initializedModel = model.init(sequelize, sequelize.constructor.DataTypes);
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

            // Wait for database to be ready
            await waitForDatabase();

            // Import all model files
            // Update your models/index.js with this exact modelFiles array:

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
                'GiftCodeClaim'
            ];

            // Initialize each model
            for (const modelName of modelFiles) {
                try {
                    models[modelName] = await initializeModel(`./${modelName}`, modelName);
                    console.log(`✅ Initialized model: ${modelName}`);
                } catch (error) {
                    console.error(`❌ Error initializing model ${modelName}:`, error);
                    throw error;
                }
            }

            // Set up model associations
            Object.values(models).forEach(model => {
                if (model.associate) {
                    model.associate(models);
                }
            });

            isInitialized = true;
            console.log('✅ All models initialized successfully');
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


