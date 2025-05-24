// Backend/models/index.js
'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.js')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Initialize models function
const initializeModels = async () => {
  try {
    console.log('Starting model initialization...');
    
    // Files to skip (these are not individual models)
    const skipFiles = ['gameModels.js', 'index.js'];
    
    // First, load all model files and get their classes
    const modelFiles = fs
      .readdirSync(__dirname)
      .filter(file => {
        return (
          file.indexOf('.') !== 0 &&
          file !== basename &&
          file.slice(-3) === '.js' &&
          file.indexOf('.test.js') === -1 &&
          !skipFiles.includes(file)
        );
      });

    console.log('Found model files:', modelFiles);

    // Load all models first (without associations)
    for (const file of modelFiles) {
      try {
        const modelPath = path.join(__dirname, file);
        console.log(`Loading model from: ${modelPath}`);
        
        const model = require(modelPath);
        
        // Handle different model export patterns
        if (typeof model === 'function') {
          // If it's a function that takes sequelize and DataTypes
          if (model.length >= 2) {
            const initializedModel = model(sequelize, Sequelize.DataTypes);
            if (initializedModel && initializedModel.name) {
              db[initializedModel.name] = initializedModel;
              console.log(`Successfully loaded model: ${initializedModel.name} from ${file}`);
            }
          } else {
            // If it's a class or function with init method
            if (typeof model.init === 'function') {
              const initializedModel = model.init(sequelize);
              if (initializedModel && initializedModel.name) {
                db[initializedModel.name] = initializedModel;
                console.log(`Successfully loaded model: ${initializedModel.name} from ${file}`);
              } else if (model.name) {
                // Handle case where init doesn't return the model but model has a name
                db[model.name] = model;
                console.log(`Successfully loaded model: ${model.name} from ${file}`);
              }
            } else {
              console.warn(`Model in ${file} doesn't have init method or proper export`);
            }
          }
        } else if (model && typeof model === 'object') {
          // Handle direct model exports or multi-model exports
          if (model.name) {
            db[model.name] = model;
            console.log(`Successfully loaded model: ${model.name} from ${file}`);
          } else {
            // Handle files that export multiple models (like gameModels.js)
            Object.keys(model).forEach(key => {
              if (model[key] && typeof model[key] === 'function' && model[key].name) {
                db[model[key].name] = model[key];
                console.log(`Successfully loaded model: ${model[key].name} from ${file}`);
              }
            });
          }
        } else {
          console.warn(`Warning: Model in ${file} has unexpected export format:`, typeof model);
        }
      } catch (error) {
        console.error(`Error loading model from file ${file}:`, error.message);
        // Continue loading other models
      }
    }

    console.log('Loaded models:', Object.keys(db));

    // Now set up associations after all models are loaded
    console.log('Setting up model associations...');
    Object.keys(db).forEach(modelName => {
      if (db[modelName] && typeof db[modelName].associate === 'function') {
        try {
          console.log(`Setting up associations for model: ${modelName}`);
          db[modelName].associate(db);
          console.log(`✓ Associations set up for model: ${modelName}`);
        } catch (error) {
          console.error(`Error setting up associations for ${modelName}:`, error.message);
          console.error('Stack trace:', error.stack);
        }
      }
    });

    console.log('✅ Model initialization completed successfully');
    return db;
  } catch (error) {
    console.error('❌ Error during model initialization:', error);
    throw error;
  }
};

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Export both the db object and initializeModels function
module.exports = db;
module.exports.initializeModels = initializeModels;