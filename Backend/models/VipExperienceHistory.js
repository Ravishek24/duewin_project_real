// Backend/models/VipExperienceHistory.js
'use strict';

module.exports = (sequelize, DataTypes) => {
    const VipExperienceHistory = sequelize.define('VipExperienceHistory', {
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
        exp_gained: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'VIP experience points gained from this bet'
        },
        bet_amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            comment: 'Bet amount that generated this experience'
        },
        game_type: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Type of game (wingo, k3, 5d, trx_wix, casino, etc.)'
        },
        game_id: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Specific game identifier (optional)'
        },
        exp_before: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'User VIP experience before this bet'
        },
        exp_after: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'User VIP experience after this bet'
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'vip_experience_history',
        timestamps: false,
        indexes: [
            {
                fields: ['user_id']
            },
            {
                fields: ['game_type']
            },
            {
                fields: ['created_at']
            },
            {
                fields: ['user_id', 'created_at']
            }
        ]
    });

    VipExperienceHistory.associate = (models) => {
        VipExperienceHistory.belongsTo(models.User, {
            foreignKey: 'user_id',
            targetKey: 'user_id',
            as: 'vipexphistoryuser'
        });
    };

    return VipExperienceHistory;
};
