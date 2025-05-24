// Backend/models/index.js - Complete Fix
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
    const modelName = model.name || file.split('.')[0];
    models[modelName] = model;
}

// Define associations with unique aliases
const defineAssociations = () => {
    // User associations
    if (models.User) {
        // Attendance records
        models.User.hasMany(models.AttendanceRecord, {
            foreignKey: 'user_id',
            as: 'attendanceRecords'
        });

        // Bank accounts
        models.User.hasMany(models.BankAccount, {
            foreignKey: 'user_id',
            as: 'bankAccounts'
        });

        // Game sessions
        models.User.hasMany(models.GameSession, {
            foreignKey: 'user_id',
            as: 'gameSessions'
        });

        // Game transactions
        models.User.hasMany(models.GameTransaction, {
            foreignKey: 'user_id',
            as: 'gameTransactions'
        });

        // Gift code claims
        models.User.hasMany(models.GiftCodeClaim, {
            foreignKey: 'user_id',
            as: 'giftCodeClaims'
        });

        // OTP requests
        models.User.hasMany(models.OtpRequest, {
            foreignKey: 'user_id',
            as: 'otpRequests'
        });

        // Referral commissions
        models.User.hasMany(models.ReferralCommission, {
            foreignKey: 'user_id',
            as: 'referralCommissions'
        });

        // Referral tree
        models.User.hasMany(models.ReferralTree, {
            foreignKey: 'user_id',
            as: 'referralTree'
        });

        // Refresh tokens
        models.User.hasMany(models.RefreshToken, {
            foreignKey: 'userId',
            as: 'refreshTokens'
        });

        // Seamless transactions
        models.User.hasMany(models.SeamlessTransaction, {
            foreignKey: 'user_id',
            as: 'seamlessTransactions'
        });

        // Third party wallet
        models.User.hasOne(models.ThirdPartyWallet, {
            foreignKey: 'user_id',
            as: 'thirdPartyWallet'
        });

        // User rebate levels
        models.User.hasMany(models.UserRebateLevel, {
            foreignKey: 'user_id',
            as: 'rebateLevels'
        });

        // User sessions
        models.User.hasMany(models.UserSession, {
            foreignKey: 'userId',
            as: 'sessions'
        });

        // VIP rewards
        models.User.hasMany(models.VipReward, {
            foreignKey: 'user_id',
            as: 'vipRewards'
        });

        // Wallet recharges
        models.User.hasMany(models.WalletRecharge, {
            foreignKey: 'user_id',
            as: 'walletRecharges'
        });

        // Wallet withdrawals
        models.User.hasMany(models.WalletWithdrawal, {
            foreignKey: 'user_id',
            as: 'walletWithdrawals'
        });
    }

    // Reverse associations
    if (models.AttendanceRecord) {
        models.AttendanceRecord.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.BankAccount) {
        models.BankAccount.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.GameSession) {
        models.GameSession.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.GameTransaction) {
        models.GameTransaction.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.GiftCodeClaim) {
        models.GiftCodeClaim.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.OtpRequest) {
        models.OtpRequest.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.ReferralCommission) {
        models.ReferralCommission.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.ReferralTree) {
        models.ReferralTree.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.RefreshToken) {
        models.RefreshToken.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
    }

    if (models.SeamlessTransaction) {
        models.SeamlessTransaction.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.ThirdPartyWallet) {
        models.ThirdPartyWallet.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.UserRebateLevel) {
        models.UserRebateLevel.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.UserSession) {
        models.UserSession.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
    }

    if (models.VipReward) {
        models.VipReward.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.WalletRecharge) {
        models.WalletRecharge.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }

    if (models.WalletWithdrawal) {
        models.WalletWithdrawal.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }
};

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
        }
      } catch (error) {
                    console.error(`Error initializing model ${modelName}:`, error);
                    throw error;
                }
            }
        }
        
        // Define associations
        defineAssociations();
        
        // Call associate method on each model if it exists
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