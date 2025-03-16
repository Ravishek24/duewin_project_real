import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

const UsdtAccount = sequelize.define('UsdtAccount', {
    usdt_account_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'user_id'
        }
    },
    wallet_address: {
        type: DataTypes.STRING,
        allowNull: false
    },
    network_type: {
        type: DataTypes.STRING,
        allowNull: false,
        // TRC20, ERC20, etc.
    },
    is_primary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'usdt_accounts',
    timestamps: false
});

// Establish relationship
User.hasMany(UsdtAccount, { foreignKey: 'user_id' });
UsdtAccount.belongsTo(User, { foreignKey: 'user_id' });

export default UsdtAccount;