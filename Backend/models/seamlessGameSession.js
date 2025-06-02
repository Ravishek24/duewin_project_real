// Backend/models/SeamlessGameSession.js
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
            remote_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Remote player ID from the game provider'
            },
            provider: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Third-party game provider name'
            },
            session_token: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Session token from the provider'
            },
            game_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Game ID'
            },
            game_id_hash: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Game ID hash'
            },
            game_url: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'URL to launch the game'
            },
            game_type: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Type of game'
            },
            session_id: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: 'Unique session identifier'
            },
            balance: {
                type: DataTypes.FLOAT,
                allowNull: false,
                defaultValue: 0
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'active'
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            ip_address: {
                type: DataTypes.STRING,
                allowNull: true
            },
            last_activity: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: DataTypes.NOW
            },
            closed_at: {
                type: DataTypes.DATE,
                allowNull: true
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
        // Only set up associations if User model exists and is properly initialized
        if (models.User && typeof models.User === 'function') {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'seamlessgamesessionuser'
            });
        } else {
            console.warn('User model not found or not properly initialized for SeamlessGameSession association');
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