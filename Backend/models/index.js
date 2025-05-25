// Backend/models/index.js - Fixed Version
'use strict';

const fs = require('fs');
const path = require('path');
const { sequelize, connectDB } = require('../config/db');

// Initialize models object
const models = {};

// Read all model files
const modelFiles = fs.readdirSync(__dirname)
      .filter(file => {
        return (
          file.indexOf('.') !== 0 &&
            file !== 'index.js' &&
            file.slice(-3) === '.js'
        );
    });

// Import all models
for (const file of modelFiles) {
    const model = require(path.join(__dirname, file));
    // Handle both class-based and function-based models
    if (model && (typeof model === 'function' || model.default)) {
        const modelClass = model.default || model;
        const modelName = modelClass.name || file.split('.')[0];
        models[modelName] = modelClass;
    }
}

// Initialize models and associations
const initializeModels = async () => {
    try {
        // First ensure database connection is established
        await connectDB();
        
        // Verify Sequelize instance and wait for it to be ready
        if (!sequelize || typeof sequelize.define !== 'function') {
            throw new Error('Invalid Sequelize instance');
        }

        // Wait for Sequelize to be fully initialized
        await new Promise((resolve, reject) => {
            if (sequelize.authenticate) {
                sequelize.authenticate()
                    .then(() => resolve())
                    .catch(reject);
            } else {
                resolve();
            }
        });

        // Initialize User model first since other models depend on it
        if (models.User && typeof models.User.init === 'function') {
            try {
                const initializedUser = models.User.init(sequelize);
                if (initializedUser) {
                    models.User = initializedUser;
                }
            } catch (error) {
                console.error('Error initializing User model:', error);
                throw error;
            }
        }

        // Initialize other models
        for (const modelName of Object.keys(models)) {
            if (modelName === 'User') continue; // Skip User as it's already initialized
            
            const model = models[modelName];
            if (typeof model.init === 'function') {
                try {
                    const initializedModel = model.init(sequelize);
                    if (initializedModel) {
                        models[modelName] = initializedModel;
                        
                        // Verify model methods
                        const requiredMethods = ['findOne', 'create', 'update', 'findAll'];
                        const missingMethods = requiredMethods.filter(method => typeof initializedModel[method] !== 'function');
                        
                        if (missingMethods.length > 0) {
                            console.warn(`Model ${modelName} is missing methods: ${missingMethods.join(', ')}`);
                            // Try to add missing methods
                            for (const method of missingMethods) {
                                initializedModel[method] = async function(...args) {
                                    return await this[method](...args);
                                };
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error initializing model ${modelName}:`, error);
                    throw error;
                }
            }
        }
        
        // Call associate method on each model if it exists
        // This will handle all associations defined in individual model files
        for (const modelName of Object.keys(models)) {
            const model = models[modelName];
            if (typeof model.associate === 'function') {
                try {
                    model.associate(models);
                } catch (error) {
                    console.error(`Error in model association for ${modelName}:`, error);
                    throw error;
                }
            }
        }
        
        // Sync models with database
        await sequelize.sync();
        
        // Verify all models are properly initialized
        const requiredModels = [
            'User', 'GamePeriod', 'BetResultWingo', 'BetResult5D', 
            'BetResultK3', 'BetResultTrxWix', 'BetRecordWingo', 
            'BetRecord5D', 'BetRecordK3', 'BetRecordTrxWix'
        ];
        
        const missingModels = requiredModels.filter(modelName => !models[modelName]);
        if (missingModels.length > 0) {
            throw new Error(`Missing required models: ${missingModels.join(', ')}`);
        }
        
        console.log('✅ All models initialized successfully');
        return models;
    } catch (error) {
        console.error('Error initializing models:', error);
        throw error;
    }
};

module.exports = {
    models,
    initializeModels
};