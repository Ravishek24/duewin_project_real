// models/UserRebateLevel.js
const { Model, DataTypes } = require('sequelize');

class UserRebateLevel extends Model {
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
            rebate_level_id: {
                type: DataTypes.INTEGER,
                allowNull: false
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
            modelName: 'UserRebateLevel',
            tableName: 'user_rebate_levels',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'userrebateleveluser'
            });
        }
        
        if (models.RebateLevel) {
            this.belongsTo(models.RebateLevel, {
                foreignKey: 'rebate_level_id',
                targetKey: 'id',
                as: 'level'
            });
        }
    }
}

module.exports = UserRebateLevel;