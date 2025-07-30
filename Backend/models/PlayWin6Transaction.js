// models/PlayWin6Transaction.js - PlayWin6 Transaction Model
const { Model, DataTypes } = require('sequelize');

class PlayWin6Transaction extends Model {
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
            session_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'playwin6_game_sessions',
                    key: 'id'
                }
            },
            type: {
                type: DataTypes.ENUM('bet', 'win', 'rollback', 'balance'),
                allowNull: false,
                comment: 'Type of transaction'
            },
            amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                comment: 'Transaction amount'
            },
            currency: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'INR',
                comment: 'Transaction currency'
            },
            provider: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Game provider (e.g., JiliGaming, PragmaticPlay)'
            },
            game_id: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Game identifier'
            },
            game_uid: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Game unique identifier from PlayWin6'
            },
            provider_tx_id: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: 'Transaction ID from PlayWin6'
            },
            operator_tx_id: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: 'Our internal transaction ID'
            },
            action: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Action type (bet, win, rollback, balance)'
            },
            action_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Action identifier from game'
            },
            old_balance: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                comment: 'Balance before transaction'
            },
            new_balance: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                comment: 'Balance after transaction'
            },
            wallet_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: true,
                comment: 'Wallet amount from callback'
            },
            status: {
                type: DataTypes.ENUM('pending', 'completed', 'failed', 'rolled_back'),
                allowNull: false,
                defaultValue: 'pending'
            },
            rollback_provider_tx_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Reference to original transaction for rollbacks'
            },
            // Additional metadata
            platform: {
                type: DataTypes.ENUM('mobile', 'desktop'),
                allowNull: true,
                comment: 'Platform where transaction occurred'
            },
            ip_address: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'IP address where transaction occurred'
            },
            callback_data: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: 'Raw callback data from PlayWin6'
            },
            encrypted_payload: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'Encrypted payload from PlayWin6'
            },
            timestamp: {
                type: DataTypes.BIGINT,
                allowNull: true,
                comment: 'Timestamp from PlayWin6 callback'
            },
            token: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Token from PlayWin6 callback'
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
            modelName: 'PlayWin6Transaction',
            tableName: 'playwin6_transactions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id']
                },
                {
                    fields: ['session_id']
                },
                {
                    fields: ['provider_tx_id']
                },
                {
                    fields: ['operator_tx_id']
                },
                {
                    fields: ['type']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['game_uid']
                },
                {
                    fields: ['created_at']
                },
                {
                    // Index for finding related transactions
                    name: 'idx_rollback_provider_tx',
                    fields: ['rollback_provider_tx_id']
                },
                {
                    // Composite index for session transactions
                    name: 'idx_session_type_status',
                    fields: ['session_id', 'type', 'status']
                },
                {
                    // Composite index for game transactions
                    name: 'idx_game_uid_provider',
                    fields: ['game_uid', 'provider']
                }
            ]
        });
    }

    static associate(models) {
        // User association
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
        
        // Session association
        if (models.PlayWin6GameSession) {
            this.belongsTo(models.PlayWin6GameSession, {
                foreignKey: 'session_id',
                as: 'session'
            });
        }
    }

    // Instance methods for transaction management
    
    // Check if transaction can be rolled back
    canRollback() {
        return this.status === 'completed' && 
               ['bet', 'win'].includes(this.type) &&
               !this.isRolledBack();
    }

    // Check if transaction has been rolled back
    isRolledBack() {
        return this.status === 'rolled_back';
    }

    // Get transaction summary for display
    getSummary() {
        return {
            id: this.id,
            type: this.type,
            amount: this.amount,
            currency: this.currency,
            status: this.status,
            game_id: this.game_id,
            game_uid: this.game_uid,
            provider: this.provider,
            created_at: this.created_at,
            operator_tx_id: this.operator_tx_id,
            provider_tx_id: this.provider_tx_id
        };
    }

    // Get callback data summary
    getCallbackSummary() {
        return {
            user_id: this.user_id,
            wallet_amount: this.wallet_amount,
            game_uid: this.game_uid,
            token: this.token,
            timestamp: this.timestamp,
            provider_tx_id: this.provider_tx_id
        };
    }

    // Check if this is a balance update transaction
    isBalanceUpdate() {
        return this.type === 'balance';
    }

    // Check if this is a bet transaction
    isBet() {
        return this.type === 'bet';
    }

    // Check if this is a win transaction
    isWin() {
        return this.type === 'win';
    }

    // Get formatted amount with currency
    getFormattedAmount() {
        return `${this.amount} ${this.currency}`;
    }

    // Get balance change (positive for wins, negative for bets)
    getBalanceChange() {
        if (this.type === 'win') {
            return this.amount;
        } else if (this.type === 'bet') {
            return -this.amount;
        }
        return 0;
    }
}

module.exports = PlayWin6Transaction; 