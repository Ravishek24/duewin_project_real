// Backend/models/WalletWithdrawal.js - PERMANENT FIX
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
            // Add order_id for unique withdrawal tracking
            order_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Unique order ID for withdrawal tracking'
            },
            withdrawal_type: {
                type: DataTypes.STRING(20),
                allowNull: true,
                defaultValue: 'BANK'
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
            // 🎯 WAGERING SYSTEM FIELDS
            wagering_status: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: 'Wagering verification details at time of withdrawal'
            },
            wagering_checked: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                comment: 'Whether wagering requirements were verified'
            },
            bank_account_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'bank_accounts',
                    key: 'id'
                }
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
            updatedAt: 'updated_at'
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
            // FIXED: Specify the correct keys explicitly
            this.belongsTo(models.PaymentGateway, {
                foreignKey: 'payment_gateway_id', // Column in wallet_withdrawals
                targetKey: 'gateway_id',          // Column in payment_gateways
                as: 'paymentGateway'
            });
        }

        if (models.BankAccount) {
            this.belongsTo(models.BankAccount, {
                foreignKey: 'bank_account_id',
                targetKey: 'id',
                as: 'bankAccount'
            });
        }

        if (models.WithdrawalAdmin) {
            this.hasOne(models.WithdrawalAdmin, {
                foreignKey: 'withdrawal_id',
                as: 'WithdrawalAdmin'
            });
        }
    }
}

module.exports = WalletWithdrawal;