// models/GameSession.js
const { Model, DataTypes } = require('sequelize');

class GameSession extends Model {
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
            game_type: {
                type: DataTypes.STRING,
                allowNull: false
            },
            session_id: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'active'
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
            modelName: 'GameSession',
            tableName: 'game_sessions',
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
        
        if (models.GameTransaction) {
            this.hasMany(models.GameTransaction, {
                foreignKey: 'session_id',
                as: 'transactions'
            });
        }
    }
}

module.exports = GameSession;