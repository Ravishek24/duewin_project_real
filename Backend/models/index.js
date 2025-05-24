// Backend/models/index.js
'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Initialize models function
const initializeModels = async () => {
  // Load all model files
  const modelFiles = fs
    .readdirSync(__dirname)
    .filter(file => {
      return (
        file.indexOf('.') !== 0 &&
        file !== basename &&
        file.slice(-3) === '.js' &&
        file.indexOf('.test.js') === -1
      );
    });

  console.log('Found model files:', modelFiles);

  for (const file of modelFiles) {
    try {
      const modelPath = path.join(__dirname, file);
      console.log(`Loading model from: ${modelPath}`);
      const model = require(modelPath);
      
      if (model && typeof model.init === 'function') {
        // Initialize model with sequelize instance
        const initializedModel = model.init(sequelize);
        db[model.name] = initializedModel;
        console.log(`Successfully loaded model: ${model.name} from ${file}`);
      } else {
        console.warn(`Warning: Model in ${file} does not have an init function`);
      }
    } catch (error) {
      console.error(`Error loading model from file ${file}:`, error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
  }

  // Set up associations after all models are loaded
  Object.keys(db).forEach(modelName => {
    if (db[modelName] && typeof db[modelName].associate === 'function') {
      try {
        db[modelName].associate(db);
        console.log(`Set up associations for model: ${modelName}`);
      } catch (error) {
        console.error(`Error setting up associations for ${modelName}:`, error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }
    }
  });

  return db;
};

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Initialize models immediately
initializeModels().then(() => {
  console.log('✅ Models initialized for game scheduler');
}).catch(error => {
  console.error('❌ Error initializing models:', error);
});

// Export both the db object and initializeModels function
module.exports = db;
module.exports.initializeModels = initializeModels;

