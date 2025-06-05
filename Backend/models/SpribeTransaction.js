// models/SpribeTransaction.js - UPDATED FOR USD AND ASSOCIATIONS
const { Model, DataTypes } = require('sequelize');

class SpribeTransaction extends Model {
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
                    model: 'spribe_game_sessions',
                    key: 'id'
                }
            },
            type: {
                type: DataTypes.ENUM('bet', 'win', 'rollback'),
                allowNull: false
            },
            amount: {
                type: DataTypes.BIGINT,
                allowNull: false,
                comment: 'Amount in smallest currency unit (e.g., cents for USD)'
            },
            currency: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'USD'
            },
            provider: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Game provider (e.g., spribe_aviator)'
            },
            game_id: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Game identifier'
            },
            provider_tx_id: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: 'Transaction ID from Spribe'
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
                comment: 'Action type (bet, win, rollback)'
            },
            action_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Action identifier from game'
            },
            old_balance: {
                type: DataTypes.BIGINT,
                allowNull: false,
                comment: 'Balance before transaction (in smallest currency units)'
            },
            new_balance: {
                type: DataTypes.BIGINT,
                allowNull: false,
                comment: 'Balance after transaction (in smallest currency units)'
            },
            status: {
                type: DataTypes.ENUM('pending', 'completed', 'failed', 'rolled_back'),
                allowNull: false,
                defaultValue: 'pending'
            },
            withdraw_provider_tx_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Reference to original bet transaction for wins'
            },
            // ADDED: Additional metadata
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
            modelName: 'SpribeTransaction',
            tableName: 'spribe_transactions',
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
                    fields: ['created_at']
                },
                {
                    // ADDED: Index for finding related transactions
                    name: 'idx_withdraw_provider_tx',
                    fields: ['withdraw_provider_tx_id']
                },
                {
                    // ADDED: Composite index for session transactions
                    name: 'idx_session_type_status',
                    fields: ['session_id', 'type', 'status']
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
        
        // FIXED: Session association
        if (models.SpribeGameSession) {
            this.belongsTo(models.SpribeGameSession, {
                foreignKey: 'session_id',
                as: 'session'
            });
        }
    }

    // ADDED: Instance methods for transaction management
    
    // Get amount in decimal format
    getDecimalAmount() {
        // For EUR/USD: divide by 100 to get from cents to euros/dollars
        switch (this.currency.toUpperCase()) {
            case 'EUR':
            case 'USD':
            case 'INR':
                return this.amount / 100;
            case 'BTC':
                return this.amount / 100000000; // satoshi to BTC
            default:
                return this.amount / 100; // default to fiat format
        }
    }

    // Get old balance in decimal format
    getDecimalOldBalance() {
        switch (this.currency.toUpperCase()) {
            case 'EUR':
            case 'USD':
            case 'INR':
                return this.old_balance / 100;
            case 'BTC':
                return this.old_balance / 100000000;
            default:
                return this.old_balance / 100;
        }
    }

    // Get new balance in decimal format
    getDecimalNewBalance() {
        switch (this.currency.toUpperCase()) {
            case 'EUR':
            case 'USD':
            case 'INR':
                return this.new_balance / 100;
            case 'BTC':
                return this.new_balance / 100000000;
            default:
                return this.new_balance / 100;
        }
    }

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
            amount: this.getDecimalAmount(),
            currency: this.currency,
            status: this.status,
            game_id: this.game_id,
            provider: this.provider,
            created_at: this.created_at,
            operator_tx_id: this.operator_tx_id,
            provider_tx_id: this.provider_tx_id
        };
    }
}

module.exports = SpribeTransaction;