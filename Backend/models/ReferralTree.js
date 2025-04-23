// models/ReferralTree.js
import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

const ReferralTree = sequelize.define('ReferralTree', {
    id: {
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
    level_1: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comma-separated list of user IDs directly referred (Level 1)'
    },
    level_2: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comma-separated list of user IDs referred by Level 1 users'
    },
    level_3: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comma-separated list of user IDs referred by Level 2 users'
    },
    level_4: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comma-separated list of user IDs referred by Level 3 users'
    },
    level_5: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comma-separated list of user IDs referred by Level 4 users'
    },
    level_6: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comma-separated list of user IDs referred by Level 5 users'
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
    tableName: 'referral_trees',
    timestamps: false
});

// Establish relationship
User.hasOne(ReferralTree, { foreignKey: 'user_id' });
ReferralTree.belongsTo(User, { foreignKey: 'user_id' });

export default ReferralTree;