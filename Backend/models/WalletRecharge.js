const { Model, DataTypes } = require('sequelize');

class WalletRecharge extends Model {
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
            status: {
                type: DataTypes.ENUM('pending', 'completed', 'failed'),
                allowNull: false,
                defaultValue: 'pending'
            },
            bonus_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00
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
            modelName: 'WalletRecharge',
            tableName: 'wallet_recharges',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'walletrechargeuser'
            });
        }
        
        if (models.PaymentGateway) {
            this.belongsTo(models.PaymentGateway, {
                foreignKey: 'payment_gateway_id',
                as: 'paymentGateway'
            });
        }
    }
}

module.exports = WalletRecharge;