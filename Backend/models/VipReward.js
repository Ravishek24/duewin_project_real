const { Model, DataTypes } = require('sequelize');

class VipReward extends Model {
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
                    key: 'id'
                }
            },
            level: {
                type: DataTypes.STRING,
                allowNull: false
            },
            reward_type: {
                type: DataTypes.STRING,
                allowNull: false
            },
            reward_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'pending'
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
            modelName: 'VipReward',
            tableName: 'vip_rewards',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'viprewarduser'
            });
        }
        
        if (models.VipLevel) {
            this.belongsTo(models.VipLevel, {
                foreignKey: 'level',
                targetKey: 'level',
                as: 'vipLevel'
            });
        }
    }
}

module.exports = VipReward; 