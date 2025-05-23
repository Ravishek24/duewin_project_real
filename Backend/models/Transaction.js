const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    type: {
        type: DataTypes.ENUM(
            'deposit',           // When user deposits money
            'withdrawal',        // When user withdraws money
            'admin_credit',      // When admin adds balance
            'admin_debit',       // When admin deducts balance
            'game_win',          // When user wins a game
            'game_loss',         // When user loses a game
            'gift_code',         // When user redeems a gift code
            'referral_bonus',    // When user gets referral bonus
            'rebate',           // When user gets rebate
            'vip_reward',       // When user gets VIP reward
            'transfer_in',      // When money is transferred in from 3rd party
            'transfer_out',     // When money is transferred out to 3rd party
            'refund'            // When a transaction is refunded
        ),
        allowNull: false,
        comment: 'Type of transaction'
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Transaction amount'
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'completed',
        comment: 'Transaction status'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Transaction description/reason'
    },
    reference_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique reference ID for the transaction'
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'user_id'
        },
        comment: 'ID of admin who created the transaction (if applicable)'
    },
    // Additional fields for different transaction types
    payment_method: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Payment method used (bank, USDT, etc.)'
    },
    payment_details: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional payment details in JSON format'
    },
    game_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Game ID if transaction is game-related'
    },
    game_type: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Type of game if transaction is game-related'
    },
    gift_code: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Gift code used if transaction is gift code related'
    },
    transfer_from: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Source of transfer if transaction is a transfer'
    },
    transfer_to: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Destination of transfer if transaction is a transfer'
    },
    previous_balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'User balance before transaction'
    },
    new_balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'User balance after transaction'
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional transaction metadata in JSON format'
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
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'transactions',
    indexes: [
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
            fields: ['reference_id']
        },
        {
            fields: ['created_by']
        },
        {
            fields: ['game_id']
        },
        {
            fields: ['gift_code']
        },
        {
            fields: ['created_at']
        }
    ]
});

module.exports = Transaction; 