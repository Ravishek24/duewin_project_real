import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

const WalletRecharge = sequelize.define('WalletRecharge', {
    recharge_id: {
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
    phone_no: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [10, 15] // Ensures phone number length is between 10 and 15 characters
        }
    },
    added_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    // Order id from our system
    order_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    // Transaction id from payment gateway
    transaction_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    time_of_request: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    time_of_success: {
        type: DataTypes.DATE,
        allowNull: true
    },
    payment_gateway: {
        type: DataTypes.STRING,
        allowNull: false
    },
    payment_status: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    remark: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'wallet_recharges',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Set up association
User.hasMany(WalletRecharge, { foreignKey: 'user_id' });
WalletRecharge.belongsTo(User, { foreignKey: 'user_id' });

export default WalletRecharge;