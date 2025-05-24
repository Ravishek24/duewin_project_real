// models/PaymentGateway.js
const { Model, DataTypes } = require('sequelize');

class PaymentGateway extends Model {
    static init(sequelize) {
        return super.init({
            gateway_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                field: 'gateway_id'
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            code: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            logo_url: {
                type: DataTypes.STRING,
                allowNull: true
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: true
            },
            supports_deposit: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: true
            },
            supports_withdrawal: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: true
            },
            min_deposit: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 100.00
            },
            max_deposit: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 100000.00
            },
            min_withdrawal: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 500.00
            },
            max_withdrawal: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 50000.00
            },
            display_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
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
            modelName: 'PaymentGateway',
            tableName: 'payment_gateways',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.PaymentGatewaySettings) {
            this.hasMany(models.PaymentGatewaySettings, {
                foreignKey: 'gateway_id',
                as: 'settings'
            });
        }
        
        if (models.WalletRecharge) {
            this.hasMany(models.WalletRecharge, {
                foreignKey: 'gateway_id',
                as: 'recharges'
            });
        }
        
        if (models.WalletWithdrawal) {
            this.hasMany(models.WalletWithdrawal, {
                foreignKey: 'gateway_id',
                as: 'withdrawals'
            });
        }
    }
}

module.exports = PaymentGateway;