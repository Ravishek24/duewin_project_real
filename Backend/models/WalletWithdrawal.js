// Backend/models/WalletWithdrawal.js
const { Model, DataTypes } = require('sequelize');

class WalletWithdrawal extends Model {
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
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            payment_gateway_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'payment_gateways',
                    key: 'gateway_id'
                }
            },
            transaction_id: {
                type: DataTypes.STRING,
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM('pending', 'completed', 'failed', 'rejected'),
                allowNull: false,
                defaultValue: 'pending'
            },
            admin_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'user_id'
                }
            },
            rejection_reason: {
                type: DataTypes.STRING,
                allowNull: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        }, {
            sequelize,
            modelName: 'WalletWithdrawal',
            tableName: 'wallet_withdrawals',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id']
                },
                {
                    fields: ['payment_gateway_id']
                },
                {
                    fields: ['transaction_id']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['admin_id']
                }
            ]
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'user'
            });
            
            this.belongsTo(models.User, {
                foreignKey: 'admin_id',
                targetKey: 'user_id',
                as: 'admin'
            });
        }
        
        if (models.PaymentGateway) {
            this.belongsTo(models.PaymentGateway, {
                foreignKey: 'payment_gateway_id',
                as: 'paymentGateway'
            });
        }
        
        if (models.BankAccount) {
            this.belongsTo(models.BankAccount, {
                foreignKey: 'bank_account_id',
                as: 'bankAccount'
            });
        }
        
        if (models.UsdtAccount) {
            this.belongsTo(models.UsdtAccount, {
                foreignKey: 'usdt_account_id',
                as: 'usdtAccount'
            });
        }
    }
}

module.exports = WalletWithdrawal;