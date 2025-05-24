// Backend/models/index.js - Complete Fix
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

// Initialize models function with comprehensive error handling
const initializeModels = async () => {
  try {
    console.log('🔧 Starting model initialization...');
    
    // Verify sequelize instance is available
    if (!sequelize) {
      throw new Error('Sequelize instance is not available');
    }
    
    // Test database connection before initializing models
    await sequelize.authenticate();
    console.log('✅ Database connection verified for model initialization');
    
    // Files to skip completely (problematic or non-model files)
    const skipFiles = [
      'gameModels.js', 
      'index.js', 
      '.DS_Store',
      'Thumbs.db'
    ];
    
    // Models that need special handling or are known to be problematic
    const problematicModels = [
      'OtpRequest.js',
      'ThirdPartyWallet.js',
      'PaymentGateway.js',
      'WalletRecharge.js',
      'WalletWithdrawal.js',
      'BankAccount.js',
      'GameSession.js',
      'GameTransaction.js',
      'SeamlessTransaction.js',
      'RefreshToken.js',
      'UserSession.js',
      'PaymentGatewaySettings.js',
      'GiftCode.js',
      'GiftCodeClaim.js',
      'VipReward.js',
      'RebateLevel.js',
      'ReferralCommission.js',
      'ReferralTree.js',
      'UserRebateLevel.js',
      'ValidReferral.js',
      'VipLevel.js',
      'UsdtAccount.js',
      'GamePeriod.js'
    ];
    
    // Get all model files
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
      })
      // Normalize file names to prevent case sensitivity issues
      .reduce((acc, file) => {
        const normalizedName = file.toLowerCase();
        if (!acc.some(f => f.toLowerCase() === normalizedName)) {
          acc.push(file);
        }
        return acc;
      }, []);

    console.log(`📁 Found ${modelFiles.length} model files:`, modelFiles);

    // Clear require cache for models to ensure fresh loading
    modelFiles.forEach(file => {
      const modelPath = path.join(__dirname, file);
      if (require.cache[require.resolve(modelPath)]) {
        delete require.cache[require.resolve(modelPath)];
      }
    });

    // Separate files into safe and problematic
    const safeModels = modelFiles.filter(file => !problematicModels.includes(file));
    const unsafeModels = modelFiles.filter(file => problematicModels.includes(file));
    
    console.log(`🟢 Safe models (${safeModels.length}):`, safeModels);
    console.log(`🟡 Problematic models (${unsafeModels.length}) - will handle carefully:`, unsafeModels);

    // Load PaymentGateway first if it exists
    const paymentGatewayFile = unsafeModels.find(file => file === 'PaymentGateway.js');
    if (paymentGatewayFile) {
      try {
        const modelPath = path.join(__dirname, paymentGatewayFile);
        console.log(`📄 Loading PaymentGateway model first: ${paymentGatewayFile}`);
        
        const model = require(modelPath);
        
        if (typeof model === 'function' && typeof model.init === 'function') {
          try {
            console.log(`🔧 Initializing PaymentGateway model`);
            const initializedModel = model.init(sequelize);
            const finalModel = initializedModel || model;
            
            if (finalModel && (finalModel.name || finalModel.constructor.name)) {
              const modelName = finalModel.name || finalModel.constructor.name;
              db[modelName] = finalModel;
              console.log(`✅ Successfully loaded PaymentGateway model`);
            }
          } catch (initError) {
            console.error(`❌ Error initializing PaymentGateway model:`, initError.message);
            throw initError; // Re-throw as this is critical
          }
        }
      } catch (error) {
        console.error(`❌ Error loading PaymentGateway model:`, error.message);
        throw error; // Re-throw as this is critical
      }
    }

    // Load UsdtAccount model early
    const usdtAccountFile = unsafeModels.find(file => file === 'UsdtAccount.js');
    if (usdtAccountFile) {
      try {
        const modelPath = path.join(__dirname, usdtAccountFile);
        console.log(`📄 Loading UsdtAccount model early: ${usdtAccountFile}`);
        
        const model = require(modelPath);
        
        if (typeof model === 'function' && typeof model.init === 'function') {
          try {
            console.log(`🔧 Initializing UsdtAccount model`);
            const initializedModel = model.init(sequelize);
            const finalModel = initializedModel || model;
            
            if (finalModel && (finalModel.name || finalModel.constructor.name)) {
              const modelName = finalModel.name || finalModel.constructor.name;
              db[modelName] = finalModel;
              console.log(`✅ Successfully loaded UsdtAccount model`);
            }
          } catch (initError) {
            console.error(`❌ Error initializing UsdtAccount model:`, initError.message);
            throw initError; // Re-throw as this is critical
          }
        }
      } catch (error) {
        console.error(`❌ Error loading UsdtAccount model:`, error.message);
        throw error; // Re-throw as this is critical
      }
    }

    // Load GamePeriod model early
    const gamePeriodFile = unsafeModels.find(file => file === 'GamePeriod.js');
    if (gamePeriodFile) {
      try {
        const modelPath = path.join(__dirname, gamePeriodFile);
        console.log(`📄 Loading GamePeriod model early: ${gamePeriodFile}`);
        
        const model = require(modelPath);
        
        if (typeof model === 'function' && typeof model.init === 'function') {
          try {
            console.log(`🔧 Initializing GamePeriod model`);
            const initializedModel = model.init(sequelize);
            const finalModel = initializedModel || model;
            
            if (finalModel && (finalModel.name || finalModel.constructor.name)) {
              const modelName = finalModel.name || finalModel.constructor.name;
              db[modelName] = finalModel;
              db.GamePeriod = finalModel; // Explicitly set GamePeriod
              console.log(`✅ Successfully loaded GamePeriod model`);
            }
          } catch (initError) {
            console.error(`❌ Error initializing GamePeriod model:`, initError.message);
            throw initError; // Re-throw as this is critical
          }
        }
      } catch (error) {
        console.error(`❌ Error loading GamePeriod model:`, error.message);
        throw error; // Re-throw as this is critical
      }
    }

    // Load safe models
    const loadedModels = [];
    for (const file of safeModels) {
      try {
        const modelPath = path.join(__dirname, file);
        console.log(`📄 Loading safe model: ${file}`);
        
        const model = require(modelPath);
        
        if (typeof model === 'function' && typeof model.init === 'function') {
          try {
            console.log(`🔧 Initializing model class: ${model.name || 'Unknown'}`);
            const initializedModel = model.init(sequelize);
            
            const finalModel = initializedModel || model;
            
            if (finalModel && (finalModel.name || finalModel.constructor.name)) {
              const modelName = finalModel.name || finalModel.constructor.name;
              db[modelName] = finalModel;
              loadedModels.push(modelName);
              console.log(`✅ Successfully loaded model: ${modelName}`);
            }
          } catch (initError) {
            console.error(`❌ Error initializing safe model ${file}:`, initError.message);
            continue;
          }
        } else {
          console.log(`🚫 Skipping ${file} - doesn't use expected pattern`);
        }
      } catch (error) {
        console.error(`❌ Error loading safe model ${file}:`, error.message);
        continue;
      }
    }

    // Now try to load remaining problematic models with extra safety
    console.log('🛡️ Attempting to load remaining problematic models with safety measures...');
    for (const file of unsafeModels.filter(f => f !== 'PaymentGateway.js' && f !== 'UsdtAccount.js')) {
      try {
        const modelPath = path.join(__dirname, file);
        console.log(`⚠️ Carefully loading problematic model: ${file}`);
        
        // Read file content first to check its structure
        const fileContent = fs.readFileSync(modelPath, 'utf8');
        
        // Skip if it uses sequelize.define() pattern
        if (fileContent.includes('sequelize.define(') && !fileContent.includes('static init(')) {
          console.log(`🚫 Skipping ${file} - uses old sequelize.define() pattern`);
          continue;
        }
        
        const model = require(modelPath);
        
        if (typeof model === 'function' && typeof model.init === 'function') {
          try {
            console.log(`🔧 Carefully initializing: ${model.name || file}`);
            const initializedModel = model.init(sequelize);
            const finalModel = initializedModel || model;
            
            if (finalModel && (finalModel.name || finalModel.constructor.name)) {
              const modelName = finalModel.name || finalModel.constructor.name;
              db[modelName] = finalModel;
              loadedModels.push(modelName);
              console.log(`✅ Successfully loaded problematic model: ${modelName}`);
            }
          } catch (initError) {
            console.warn(`⚠️ Failed to initialize problematic model ${file}, skipping:`, initError.message);
            continue;
          }
        } else {
          console.log(`🚫 Skipping ${file} - doesn't use expected pattern`);
        }
        
      } catch (error) {
        console.warn(`⚠️ Error loading problematic model ${file}, skipping:`, error.message);
        continue;
      }
    }

    console.log(`📊 Successfully loaded ${loadedModels.length} models:`, loadedModels);

    // Wait for all models to be registered
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Set up associations with error handling
    console.log('🔗 Setting up model associations...');
    const associationErrors = [];
    
    Object.keys(db).forEach(modelName => {
      if (db[modelName] && typeof db[modelName].associate === 'function') {
        try {
          console.log(`🔗 Setting up associations for: ${modelName}`);
          db[modelName].associate(db);
          console.log(`✅ Associations completed for: ${modelName}`);
        } catch (error) {
          console.warn(`⚠️ Association error for ${modelName}, continuing:`, error.message);
          associationErrors.push({ model: modelName, error: error.message });
        }
      }
    });

    if (associationErrors.length > 0) {
      console.warn('⚠️ Some associations failed:', associationErrors);
    }

    return db;
  } catch (error) {
    console.error('❌ Model initialization failed:', error);
    throw error;
  }
};

// Export the sequelize instance and initializeModels function
module.exports = {
  sequelize,
  initializeModels,
  GamePeriod: db.GamePeriod // Explicitly export GamePeriod
};