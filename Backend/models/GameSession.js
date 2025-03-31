// models/GameSession.js
import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

const GameSession = sequelize.define('GameSession', {
    session_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'user_id'
        }
    },
    provider: {
        type: DataTypes.STRING,
        allowNull: false
    },
    game_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    launch_token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    session_token: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false
    },
    platform: {
        type: DataTypes.ENUM('mobile', 'desktop'),
        allowNull: true
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    start_time: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    end_time: {
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
    tableName: 'game_sessions',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['launch_token']
        },
        {
            unique: true,
            fields: ['session_token']
        },
        {
            fields: ['user_id']
        },
        {
            fields: ['is_active']
        },
        {
            fields: ['start_time']
        }
    ]
});

// Establish relationship
User.hasMany(GameSession, { foreignKey: 'user_id' });
GameSession.belongsTo(User, { foreignKey: 'user_id' });

export default GameSession;