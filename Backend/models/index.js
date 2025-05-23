// Backend/models/index.js
const { sequelize, connectDB } = require('../config/db');
const { DataTypes } = require('sequelize');

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
const SeamlessGameSession = require('./SeamlessGameSession');
const PaymentGateway = require('./PaymentGateway');
const GameConfig = require('./GameConfig');
const GamePeriod = require('./GamePeriod');
const BetRecordWingo = require('./BetRecordWingo');
const BetResultWingo = require('./BetResultWingo');
const BetRecord5D = require('./BetRecord5D');
const BetResult5D = require('./BetResult5D');
const BetRecordK3 = require('./BetRecordK3');
const BetResultK3 = require('./BetResultK3');
const VipReward = require('./VipReward');
const Transaction = require('./Transaction');
const GiftCode = require('./GiftCode');
const GiftCodeClaim = require('./GiftCodeClaim');
const BetRecordTrxWix = require('./BetRecordTrxWix');
const BetResultTrxWix = require('./BetResultTrxWix');
const RateLimitViolation = require('./RateLimitViolation')(sequelize, DataTypes);
const UserSession = require('./UserSession');
const RefreshToken = require('./RefreshToken');
const OtpRequest = require('./OtpRequest');
const PaymentGatewaySettings = require('./PaymentGatewaySettings');

// Function to set up all model associations
const setupAssociations = () => {
    try {
        // Basic user relationships
        User.hasMany(BankAccount, { foreignKey: 'user_id', as: 'bankAccounts' });
        BankAccount.belongsTo(User, { foreignKey: 'user_id', as: 'bankAccountUser' });

        User.hasMany(UsdtAccount, { foreignKey: 'user_id', as: 'usdtAccounts' });
        UsdtAccount.belongsTo(User, { foreignKey: 'user_id', as: 'usdtAccountUser' });

        User.hasMany(WalletRecharge, { foreignKey: 'user_id', as: 'recharges' });
        WalletRecharge.belongsTo(User, { foreignKey: 'user_id', as: 'rechargeUser' });
        WalletRecharge.belongsTo(PaymentGateway, { foreignKey: 'payment_gateway_id', as: 'paymentGateway' });

        User.hasMany(WalletWithdrawal, { foreignKey: 'user_id', as: 'withdrawals' });
        WalletWithdrawal.belongsTo(User, { foreignKey: 'user_id', as: 'withdrawalUser' });
        WalletWithdrawal.belongsTo(BankAccount, { foreignKey: 'bank_account_id', as: 'bankAccount' });
        WalletWithdrawal.belongsTo(UsdtAccount, { foreignKey: 'usdt_account_id', as: 'usdtAccount' });
        WalletWithdrawal.belongsTo(User, { foreignKey: 'admin_id', as: 'adminUser' });

        // Referrals
        User.hasMany(ReferralTree, { foreignKey: 'user_id', as: 'referralTrees' });
        ReferralTree.belongsTo(User, { foreignKey: 'user_id', as: 'referredUser', targetKey: 'user_id' });
        ReferralTree.belongsTo(User, { foreignKey: 'referrer_id', as: 'referrer', targetKey: 'user_id' });

        User.hasMany(ReferralTree, { foreignKey: 'referrer_id', as: 'referredUsers', targetKey: 'user_id' });

        User.hasMany(ReferralCommission, { foreignKey: 'user_id', as: 'earnedCommissions' });
        User.hasMany(ReferralCommission, { foreignKey: 'referred_user_id', as: 'generatedCommissions' });
        ReferralCommission.belongsTo(User, { foreignKey: 'user_id', as: 'commissionEarner' });
        ReferralCommission.belongsTo(User, { foreignKey: 'referred_user_id', as: 'commissionSource' });

        User.hasMany(ValidReferral, { foreignKey: 'referrer_id', as: 'validReferrals' });
        ValidReferral.belongsTo(User, { foreignKey: 'referrer_id', as: 'validReferralReferrer' });
        ValidReferral.belongsTo(User, { foreignKey: 'referred_id', as: 'validReferralReferred' });

        // VIP and Rebate relationships
        User.hasOne(UserRebateLevel, { foreignKey: 'user_id', as: 'rebateLevel' });
        UserRebateLevel.belongsTo(User, { foreignKey: 'user_id', as: 'rebateLevelUser' });
        UserRebateLevel.belongsTo(RebateLevel, { foreignKey: 'rebate_level', targetKey: 'level', as: 'rebateLevel' });

        User.hasMany(VipReward, { foreignKey: 'user_id', as: 'vipRewards' });
        VipReward.belongsTo(User, { foreignKey: 'user_id', as: 'vipRewardUser' });
        VipReward.belongsTo(VipLevel, { foreignKey: 'level', targetKey: 'level', as: 'vipLevel' });

        // Game relationships
        User.hasMany(GameSession, { foreignKey: 'user_id', as: 'gameSessions' });
        GameSession.belongsTo(User, { foreignKey: 'user_id', as: 'gameSessionUser' });

        User.hasMany(GameTransaction, { foreignKey: 'user_id', as: 'gameTransactions' });
        GameTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'gameTransactionUser' });

        User.hasMany(SeamlessGameSession, { foreignKey: 'user_id', as: 'seamlessGameSessions' });
        SeamlessGameSession.belongsTo(User, { foreignKey: 'user_id', as: 'seamlessGameSessionUser' });

        User.hasMany(SeamlessTransaction, { foreignKey: 'user_id', as: 'seamlessTransactions' });
        SeamlessTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'seamlessTransactionUser' });
        SeamlessTransaction.belongsTo(SeamlessGameSession, { foreignKey: 'session_id', as: 'session' });

        // Betting relationships
        User.hasMany(BetRecordWingo, { foreignKey: 'user_id', as: 'betRecordsWingo' });
        BetRecordWingo.belongsTo(User, { foreignKey: 'user_id', as: 'betRecordWingoUser' });
        BetResultWingo.belongsTo(BetRecordWingo, { foreignKey: 'bet_id', as: 'bet' });
        // Betting relationships

        User.hasMany(BetRecord5D, { foreignKey: 'user_id', as: 'betRecords5D' });
        BetRecord5D.belongsTo(User, { foreignKey: 'user_id', as: 'betRecord5DUser' });
        BetResult5D.belongsTo(BetRecord5D, { foreignKey: 'bet_id', as: 'bet' });

        User.hasMany(BetRecordK3, { foreignKey: 'user_id', as: 'betRecordsK3' });
        BetRecordK3.belongsTo(User, { foreignKey: 'user_id', as: 'betRecordK3User' });
        BetResultK3.belongsTo(BetRecordK3, { foreignKey: 'bet_id', as: 'bet' });

        // Transaction relationships
        User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions' });
        Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'transactionUser' });
        Transaction.belongsTo(User, { foreignKey: 'created_by', as: 'createdByAdmin' });

        // GiftCode relationships
        User.hasMany(GiftCode, { foreignKey: 'user_id', as: 'giftCodes' });
        GiftCode.belongsTo(User, { foreignKey: 'user_id', as: 'giftCodeUser' });

        User.hasMany(GiftCodeClaim, { foreignKey: 'user_id', as: 'giftCodeClaims' });
        GiftCodeClaim.belongsTo(User, { foreignKey: 'user_id', as: 'giftCodeClaimUser' });
        GiftCodeClaim.belongsTo(GiftCode, { foreignKey: 'gift_code_id' });

        // Rate limit relationships
        User.hasMany(RateLimitViolation, { 
            foreignKey: 'user_id', 
            as: 'rateLimitViolations',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        RateLimitViolation.belongsTo(User, { 
            foreignKey: 'user_id', 
            as: 'user',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        RateLimitViolation.belongsTo(User, { 
            foreignKey: 'unblocked_by', 
            as: 'unblocker',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });

        console.log('✅ Model associations set up successfully');
    } catch (error) {
        console.error('❌ Error setting up model associations:', error);
        throw error;
    }
};

// Function to initialize all models
const initializeModels = async () => {
    try {
        // First connect to the database
        await connectDB();
        console.log('✅ Database connection established successfully');
        
        // Wait for Sequelize to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Set up associations before any model operations
        setupAssociations();
        
        // Wait for associations to be fully set up
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify that models are properly initialized
        try {
            await User.findOne({ limit: 1 });
            console.log('✅ User model verified');
        } catch (error) {
            console.error('❌ Error verifying User model:', error);
            throw error;
        }
        
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
    VipReward,
    Transaction,
    GiftCode,
    GiftCodeClaim,
    initializeModels,
    BetRecordTrxWix,
    BetResultTrxWix,
    RateLimitViolation,
    UserSession,
    RefreshToken,
    OtpRequest,
    PaymentGatewaySettings,
};

