// models/UserRebateLevel.js
import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';
import RebateLevel from './RebateLevel.js';

const UserRebateLevel = sequelize.define('UserRebateLevel', {
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
    rebate_level: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: RebateLevel,
            key: 'level'
        },
        defaultValue: 'L0'
    },
    team_members_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    team_total_betting: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
    },
    team_total_deposit: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
    },
    last_updated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'user_rebate_levels',
    timestamps: false,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['rebate_level']
        }
    ]
});

// Establish relationships
User.hasOne(UserRebateLevel, { foreignKey: 'user_id' });
UserRebateLevel.belongsTo(User, { foreignKey: 'user_id' });

RebateLevel.hasMany(UserRebateLevel, { foreignKey: 'rebate_level' });
UserRebateLevel.belongsTo(RebateLevel, { foreignKey: 'rebate_level', targetKey: 'level' });

export default UserRebateLevel;