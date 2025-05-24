// Backend/models/SeamlessTransaction.js
const { Model, DataTypes } = require('sequelize');

class SeamlessTransaction extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            transaction_id: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: 'Internal transaction ID'
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'user_id'
                }
            },
            remote_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Remote player ID from the game provider'
            },
            provider_transaction_id: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Transaction ID from the game provider'
            },
            provider: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Game provider name'
            },
            game_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Game ID'
            },
            game_id_hash: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Game ID hash'
            },
            round_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Game round ID'
            },
            type: {
                type: DataTypes.ENUM('balance', 'debit', 'credit', 'rollback'),
                allowNull: false,
                comment: 'Type of transaction'
            },
            amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Transaction amount'
            },
            session_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Game session ID'
            },
            wallet_balance_before: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: true,
                comment: 'Wallet balance before transaction'
            },
            wallet_balance_after: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: true,
                comment: 'Wallet balance after transaction'
            },
            is_freeround_bet: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether this is a free round bet'
            },
            is_freeround_win: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether this is a free round win'
            },
            is_jackpot_win: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether this is a jackpot win'
            },
            jackpot_contribution_in_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Jackpot contribution amount'
            },
            gameplay_final: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether this finalizes the gameplay'
            },
            related_transaction_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Related transaction ID (for rollbacks)'
            },
            status: {
                type: DataTypes.ENUM('pending', 'success', 'failed', 'rolledback'),
                allowNull: false,
                defaultValue: 'success',
                comment: 'Transaction status'
            },
            error_message: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'Error message if transaction failed'
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
            modelName: 'SeamlessTransaction',
            tableName: 'seamless_transactions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id']
                },
                {
                    fields: ['provider_transaction_id']
                },
                {
                    fields: ['type']
                },
                {
                    fields: ['session_id']
                },
                {
                    fields: ['created_at']
                }
            ]
        });
    }

    static associate(models) {
        // Only set up associations if models exist and are properly initialized
        if (models.User && typeof models.User === 'function') {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'seamlesstransactionuser'
            });
        } else {
            console.warn('User model not found or not properly initialized for SeamlessTransaction association');
        }
        
        if (models.SeamlessGameSession && typeof models.SeamlessGameSession === 'function') {
            this.belongsTo(models.SeamlessGameSession, {
                foreignKey: 'session_id',
                targetKey: 'session_id',
                as: 'gameSession'
            });
        } else {
            console.warn('SeamlessGameSession model not found or not properly initialized for SeamlessTransaction association');
        }
    }
}

module.exports = SeamlessTransaction;