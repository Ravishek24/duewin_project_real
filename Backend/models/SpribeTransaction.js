// models/SpribeTransaction.js
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
                defaultValue: 'INR'
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
                comment: 'Balance before transaction'
            },
            new_balance: {
                type: DataTypes.BIGINT,
                allowNull: false,
                comment: 'Balance after transaction'
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
                }
            ]
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
        if (models.SpribeGameSession) {
            this.belongsTo(models.SpribeGameSession, {
                foreignKey: 'session_id',
                as: 'session'
            });
        }
    }
}

module.exports = SpribeTransaction; 