// models/RebateTeam.js
const { Model, DataTypes } = require('sequelize');

class RebateTeam extends Model {
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
                unique: true,
                references: {
                    model: 'users',
                    key: 'user_id'
                }
            },
            current_rebet_level: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Current rebate level (0-10)'
            },
            current_team_number: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Total number of team members (all levels)'
            },
            current_deposit: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total deposit amount by team members'
            },
            current_team_betting: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total daily betting amount by team members'
            },
            level_1_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of direct referrals (level 1)'
            },
            level_2_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of level 2 referrals'
            },
            level_3_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of level 3 referrals'
            },
            level_4_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of level 4 referrals'
            },
            level_5_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of level 5 referrals'
            },
            level_6_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of level 6 referrals'
            },
            last_updated: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                comment: 'Last time team data was updated'
            }
        }, {
            sequelize,
            modelName: 'RebateTeam',
            tableName: 'rebet_team_table',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        // Association with User
        this.belongsTo(models.User, {
            foreignKey: 'user_id',
            targetKey: 'user_id',
            as: 'user'
        });
    }
}

module.exports = RebateTeam; 