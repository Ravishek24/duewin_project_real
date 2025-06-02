// Backend/models/VaultTransaction.js
const { Model, DataTypes } = require('sequelize');

class VaultTransaction extends Model {
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
            order_no: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: 'Unique order number for the transaction'
            },
            transaction_type: {
                type: DataTypes.ENUM('deposit', 'withdrawal', 'interest'),
                allowNull: false,
                comment: 'Type of vault transaction'
            },
            amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                comment: 'Transaction amount'
            },
            vault_balance_before: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                comment: 'Vault balance before transaction'
            },
            vault_balance_after: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                comment: 'Vault balance after transaction'
            },
            wallet_balance_before: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: true,
                comment: 'Main wallet balance before transaction (for deposits/withdrawals)'
            },
            wallet_balance_after: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: true,
                comment: 'Main wallet balance after transaction (for deposits/withdrawals)'
            },
            interest_rate: {
                type: DataTypes.DECIMAL(5, 4),
                allowNull: true,
                comment: 'Interest rate applied (for interest transactions)'
            },
            vip_level: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: 'User VIP level at time of transaction'
            },
            status: {
                type: DataTypes.ENUM('pending', 'completed', 'failed'),
                allowNull: false,
                defaultValue: 'completed'
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'Transaction description'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: 'Additional transaction metadata'
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
            modelName: 'VaultTransaction',
            tableName: 'vault_transactions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id']
                },
                {
                    fields: ['transaction_type']
                },
                {
                    fields: ['order_no']
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
                targetKey: 'user_id',
                as: 'vaulttransactionuser'
            });
        }
        
        if (models.UserVault) {
            this.belongsTo(models.UserVault, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'vault'
            });
        }
    }
}

module.exports = VaultTransaction;