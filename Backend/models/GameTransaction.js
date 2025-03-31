// models/GameTransaction.js
import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

const GameTransaction = sequelize.define('GameTransaction', {
    transaction_id: {
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
    provider: {
        type: DataTypes.STRING,
        allowNull: false
    },
    game_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    provider_tx_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    operator_tx_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    type: {
        type: DataTypes.ENUM('bet', 'win', 'rollback', 'freebet'),
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'rolled_back'),
        defaultValue: 'pending'
    },
    action_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    platform: {
        type: DataTypes.ENUM('mobile', 'desktop'),
        allowNull: false
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    related_tx_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Related transaction ID for rollbacks or wins'
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
    tableName: 'game_transactions',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['provider_tx_id']
        },
        {
            fields: ['user_id']
        },
        {
            fields: ['type']
        },
        {
            fields: ['status']
        },
        {
            fields: ['created_at']
        }
    ]
});

// Establish relationship
User.hasMany(GameTransaction, { foreignKey: 'user_id' });
GameTransaction.belongsTo(User, { foreignKey: 'user_id' });

export default GameTransaction;