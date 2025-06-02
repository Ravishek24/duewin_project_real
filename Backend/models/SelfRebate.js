// Backend/models/SelfRebate.js
const { Model, DataTypes } = require('sequelize');

class SelfRebate extends Model {
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
            bet_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                comment: 'Original bet amount'
            },
            rebate_rate: {
                type: DataTypes.DECIMAL(5, 4),
                allowNull: false,
                comment: 'Rebate rate applied (percentage as decimal)'
            },
            rebate_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: 'Rebate amount credited'
            },
            game_type: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Type of house game (wingo, 5d, k3, trx_wix)'
            },
            game_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Specific game identifier'
            },
            vip_level: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: 'User VIP level at time of rebate'
            },
            bet_reference_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Reference to original bet'
            },
            status: {
                type: DataTypes.ENUM('pending', 'credited', 'failed'),
                allowNull: false,
                defaultValue: 'credited'
            },
            credited_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'When rebate was credited to wallet'
            },
            batch_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Processing batch identifier'
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
            modelName: 'SelfRebate',
            tableName: 'self_rebates',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id']
                },
                {
                    fields: ['game_type']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['created_at']
                },
                {
                    fields: ['user_id', 'created_at']
                }
            ]
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'selfrebateuser'
            });
        }
    }
}

module.exports = SelfRebate;