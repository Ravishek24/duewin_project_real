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
            reward_date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
                comment: 'Date for which reward is calculated'
            },
            // Lottery category achievements
            lottery_bet_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total bet amount in lottery games for the day'
            },
            lottery_milestone_50k_claimed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether 50K lottery milestone reward is claimed'
            },
            lottery_milestone_100k_claimed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether 100K lottery milestone reward is claimed'
            },
            // All games category achievements
            all_games_bet_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total bet amount in all games for the day'
            },
            all_games_milestone_500_claimed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether 500 all games milestone reward is claimed'
            },
            // Reward amounts
            lottery_reward_earned: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total lottery rewards earned for the day'
            },
            all_games_reward_earned: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total all games rewards earned for the day'
            },
            total_reward_earned: {
                type: DataTypes.DECIMAL(10, 2),
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
                    fields: ['user_id', 'reward_date']
                },
                {
                    fields: ['reward_date']
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