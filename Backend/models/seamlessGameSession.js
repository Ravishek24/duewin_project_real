// Backend/models/seamlessGameSession.js
const { Model, DataTypes } = require('sequelize');

class SeamlessGameSession extends Model {
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
            modelName: 'SeamlessGameSession',
            tableName: 'seamless_game_sessions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        // Only set up associations if models exist
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'user'
            });
        }
        
        if (models.SeamlessTransaction) {
            this.hasMany(models.SeamlessTransaction, {
                foreignKey: 'session_id',
                as: 'transactions'
            });
        }
    }
}

module.exports = SeamlessGameSession;