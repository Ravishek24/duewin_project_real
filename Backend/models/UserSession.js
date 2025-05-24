const { Model, DataTypes } = require('sequelize');

class UserSession extends Model {
    static init(sequelize) {
        return super.init({
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'Users',
                    key: 'id'
                }
            },
            ipAddress: {
                type: DataTypes.STRING,
                allowNull: false
            },
            lastActive: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            expiresAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            isValid: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            }
        }, {
            sequelize,
            modelName: 'UserSession',
            tableName: 'user_sessions',
            timestamps: true
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'userId',
                as: 'usersessionuser'
            });
        }
    }
}

module.exports = UserSession; 