// models/VipLevel.js
const { Model, DataTypes } = require('sequelize');

class VipLevel extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            level: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true
            },
            required_exp: {
                type: DataTypes.BIGINT,
                allowNull: false,
                defaultValue: 0
            },
            bonus_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00
            },
            monthly_reward: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00
            },
            rebate_rate: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0.00
            },
            vault_interest_rate: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Vault interest rate percentage for this VIP level'
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
            modelName: 'VipLevel',
            tableName: 'vip_levels',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.User) {
            this.hasMany(models.User, {
                foreignKey: 'vip_level',
                sourceKey: 'level',
                as: 'vipuser'
            });
        }
    }
}

module.exports = VipLevel;