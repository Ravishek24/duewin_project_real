// Backend/models/Transaction.js
const { Model, DataTypes } = require('sequelize');

class Transaction extends Model {
    static init(sequelize) {
        return super.init({
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
                    'game_move_in',      // 🆕 When user enters a game room
                    'game_move_out',     // 🆕 When user leaves a game room
                    'gift_code',         // When user redeems a gift code
                    'referral_bonus',    // When user gets referral bonus
                    'registration_bonus', // 🆕 When user gets signup bonus
                    'first_deposit_bonus', // 🆕 When user gets first deposit bonus
                    'deposit_rejected',    // 🆕 When admin rejects a deposit
                    'direct_bonus',        // 🆕 When user gets direct referral bonus
                    'attendance_bonus',    // 🆕 When user gets attendance bonus
                    'deposit_failed',      // 🆕 When deposit fails
                    'withdrawal_failed',   // 🆕 When withdrawal fails
                    'withdrawal_rejected', // 🆕 When admin rejects withdrawal
                    'self_rebate',         // 🆕 When user gets self rebate from house games
                    'referral_commission', // 🆕 When user gets referral commission from bets
                    'activity_reward',     // 🆕 When user gets activity milestone reward
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
            sequelize,
            modelName: 'Transaction',
            tableName: 'transactions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
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
                },
                // OPTIMIZATION: Add composite indexes for common query patterns
                {
                    fields: ['user_id', 'created_at'],
                    name: 'idx_transactions_user_created'
                },
                {
                    fields: ['user_id', 'type', 'created_at'],
                    name: 'idx_transactions_user_type_created'
                },
                {
                    fields: ['type', 'status', 'created_at'],
                    name: 'idx_transactions_type_status_created'
                },
                {
                    fields: ['user_id', 'type', 'status'],
                    name: 'idx_transactions_user_type_status'
                },
                {
                    fields: ['reference_id', 'type'],
                    name: 'idx_transactions_reference_type'
                }
            ]
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'transactionuser'
            });

            this.belongsTo(models.User, {
                foreignKey: 'created_by',
                targetKey: 'user_id',
                as: 'creator'
            });
        }
    }
}

module.exports = Transaction;