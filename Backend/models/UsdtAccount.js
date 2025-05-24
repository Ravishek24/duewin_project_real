const { Model, DataTypes } = require('sequelize');

class UsdtAccount extends Model {
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
            address: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            network: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            remark: {
                type: DataTypes.STRING(255),
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
            modelName: 'UsdtAccount',
            tableName: 'usdt_accounts',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }
}

module.exports = UsdtAccount; 