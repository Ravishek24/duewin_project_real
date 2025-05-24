const { Model, DataTypes } = require('sequelize');

class RefreshToken extends Model {
    static init(sequelize) {
        return super.init({
            token: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                }
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
            modelName: 'RefreshToken',
            tableName: 'refresh_tokens',
            timestamps: true
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'userId',
                as: 'user'
            });
        }
    }
}

module.exports = RefreshToken; 