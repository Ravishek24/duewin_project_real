// Backend/models/index.js
const { sequelize } = require('../config/db');

// Import all models
const User = require('./User');
const BankAccount = require('./BankAccount');
const UsdtAccount = require('./UsdtAccount');
const WalletRecharge = require('./WalletRecharge');
const WalletWithdrawal = require('./WalletWithdrawal');
const WithdrawalAdmin = require('./WithdrawalAdmin');
const ReferralTree = require('./ReferralTree');
const ReferralCommission = require('./ReferralCommission');
const ValidReferral = require('./ValidReferral');
const UserRebateLevel = require('./UserRebateLevel');
const RebateLevel = require('./RebateLevel');
const VipLevel = require('./VipLevel');
const AttendanceRecord = require('./AttendanceRecord');
const GameSession = require('./GameSession');
const GameTransaction = require('./GameTransaction');
const SeamlessTransaction = require('./SeamlessTransaction');
const SeamlessGameSession = require('./seamlessGameSession');
const PaymentGateway = require('./PaymentGateway');
const GameConfig = require('./GameConfig');
const GamePeriod = require('./GamePeriod');
const BetRecordWingo = require('./BetRecordWingo');
const BetResultWingo = require('./BetResultWingo');
const BetRecord5D = require('./BetRecord5D');
const BetResult5D = require('./BetResult5D');
const BetRecordK3 = require('./BetRecordK3');
const BetResultK3 = require('./BetResultK3');

// Function to set up all model associations
const setupAssociations = () => {
    // Basic user relationships
    User.hasMany(BankAccount, { foreignKey: 'user_id' });
    BankAccount.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(UsdtAccount, { foreignKey: 'user_id' });
    UsdtAccount.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(WalletRecharge, { foreignKey: 'user_id' });
    WalletRecharge.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(WalletWithdrawal, { foreignKey: 'user_id' });
    WalletWithdrawal.belongsTo(User, { foreignKey: 'user_id' });

    // Referrals
    User.hasOne(ReferralTree, { foreignKey: 'user_id' });
    ReferralTree.belongsTo(User, { foreignKey: 'user_id' });

    // Referral Commissions - using unique aliases and scopes
    User.hasMany(ReferralCommission, { 
        foreignKey: 'user_id',
        as: 'EarnedCommissions',
        scope: { type: 'earned' }
    });

    User.hasMany(ReferralCommission, { 
        foreignKey: 'referred_user_id',
        as: 'GeneratedCommissions',
        scope: { type: 'generated' }
    });

    // Single belongsTo association for ReferralCommission
    ReferralCommission.belongsTo(User, { 
        foreignKey: 'user_id',
        as: 'Earner'
    });

    // VIP and Rebate relationships
    User.hasOne(UserRebateLevel, { foreignKey: 'user_id' });
    UserRebateLevel.belongsTo(User, { foreignKey: 'user_id' });

    RebateLevel.hasMany(UserRebateLevel, { foreignKey: 'rebate_level' });
    UserRebateLevel.belongsTo(RebateLevel, { foreignKey: 'rebate_level', targetKey: 'level' });

    // Game relationships
    User.hasMany(GameSession, { foreignKey: 'user_id' });
    GameSession.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(GameTransaction, { foreignKey: 'user_id' });
    GameTransaction.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(SeamlessGameSession, { foreignKey: 'user_id' });
    SeamlessGameSession.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(SeamlessTransaction, { foreignKey: 'user_id' });
    SeamlessTransaction.belongsTo(User, { foreignKey: 'user_id' });

    // Betting relationships
    User.hasMany(BetRecordWingo, { foreignKey: 'user_id' });
    BetRecordWingo.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(BetRecord5D, { foreignKey: 'user_id' });
    BetRecord5D.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(BetRecordK3, { foreignKey: 'user_id' });
    BetRecordK3.belongsTo(User, { foreignKey: 'user_id' });
};

// Set up associations
setupAssociations();

// Function to initialize all models
const initializeModels = async () => {
    try {
        // Instead of sync, we'll just verify the connection
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully');
        
        // Log that models are loaded
        console.log('✅ All models loaded successfully');
    } catch (error) {
        console.error('❌ Error initializing models:', error);
        throw error;
    }
};

// Export all models and the initialization function
module.exports = {
    sequelize,
    User,
    BankAccount,
    UsdtAccount,
    WalletRecharge,
    WalletWithdrawal,
    WithdrawalAdmin,
    ReferralTree,
    ReferralCommission,
    ValidReferral,
    UserRebateLevel,
    RebateLevel,
    VipLevel,
    AttendanceRecord,
    GameSession,
    GameTransaction,
    SeamlessTransaction,
    SeamlessGameSession,
    PaymentGateway,
    GameConfig,
    GamePeriod,
    BetRecordWingo,
    BetResultWingo,
    BetRecord5D,
    BetResult5D,
    BetRecordK3,
    BetResultK3,
    initializeModels
};

// Add this function to sync the models in Backend/index.js  222.222
