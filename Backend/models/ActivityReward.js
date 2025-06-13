// Backend/models/ActivityReward.js
const { Model, DataTypes } = require('sequelize');

class ActivityReward extends Model {
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
            date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
                comment: 'Date for which reward is calculated'
            },
            lottery_bet_amount: {
                type: DataTypes.DECIMAL(20, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total bet amount in lottery games for the day'
            },
            all_games_bet_amount: {
                type: DataTypes.DECIMAL(20, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total bet amount in all games for the day'
            },
            claimed_milestones: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: 'JSON object storing claimed milestones'
            },
            total_rewards: {
                type: DataTypes.DECIMAL(20, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total rewards earned for the day'
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
            modelName: 'ActivityReward',
            tableName: 'activity_rewards',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    unique: true,
                    fields: ['user_id', 'date']
                },
                {
                    fields: ['date']
                }
            ]
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'activityrewarduser'
            });
        }
    }
}

module.exports = ActivityReward;