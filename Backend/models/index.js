// Backend/models/index.js
import { sequelize } from '../config/db.js';

// Import all models
import User from './User.js';
import BankAccount from './BankAccount.js';
import UsdtAccount from './UsdtAccount.js';
import WalletRecharge from './WalletRecharge.js';
import WalletWithdrawal from './WalletWithdrawal.js';
import WithdrawalAdmin from './WithdrawalAdmin.js';
import ReferralTree from './ReferralTree.js';
import ReferralCommission from './ReferralCommission.js';
import ValidReferral from './ValidReferral.js';
import UserRebateLevel from './UserRebateLevel.js';
import RebateLevel from './RebateLevel.js';
import VipLevel from './VipLevel.js';
import AttendanceRecord from './AttendanceRecord.js';
import GameSession from './GameSession.js';
import GameTransaction from './GameTransaction.js';
import SeamlessTransaction from './SeamlessTransaction.js';
import SeamlessGameSession from './seamlessGameSession.js';
import PaymentGateway from './PaymentGateway.js';
import GameConfig from './GameConfig.js';
import GamePeriod from './GamePeriod.js';
import BetRecordWingo from './BetRecordWingo.js';
import BetResultWingo from './BetResultWingo.js';
import BetRecord5D from './BetRecord5D.js';
import BetResult5D from './BetResult5D.js';
import BetRecordK3 from './BetRecordK3.js';
import BetResultK3 from './BetResultK3.js';

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

    // Referral Commissions - using unique aliases
    User.hasMany(ReferralCommission, { 
        foreignKey: 'user_id', 
        as: 'EarnedCommissions',
        scope: { type: 'earned' }
    });
    ReferralCommission.belongsTo(User, { 
        foreignKey: 'user_id', 
        as: 'Earner'
    });

    User.hasMany(ReferralCommission, { 
        foreignKey: 'referred_user_id', 
        as: 'GeneratedCommissions',
        scope: { type: 'generated' }
    });
    ReferralCommission.belongsTo(User, { 
        foreignKey: 'referred_user_id', 
        as: 'Generator'
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
    console.log('✅ All models initialized');
};

// Export all models and the initialization function
export {
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

export default {
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