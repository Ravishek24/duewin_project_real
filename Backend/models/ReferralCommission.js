// models/ReferralCommission.js
const { Model, DataTypes } = require('sequelize');

class ReferralCommission extends Model {
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
            referred_user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'user_id'
                }
            },
            level: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
            },
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00
            },
            type: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Type of commission (bet, direct_bonus, etc.)'
            },
            rebate_type: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Type of rebate (lottery, casino)'
            },
            distribution_batch_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Batch ID for commission distribution'
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'pending',
                comment: 'Status of commission (pending, paid, cancelled)'
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
            modelName: 'ReferralCommission',
            tableName: 'referral_commissions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'referralcommissionuser'
            });
            
            this.belongsTo(models.User, {
                foreignKey: 'referred_user_id',
                as: 'referredUser'
            });
        }
        
        if (models.RebateLevel) {
            this.belongsTo(models.RebateLevel, {
                foreignKey: 'level',
                targetKey: 'level',
                as: 'rebateLevel'
            });
        }
    }
}

module.exports = ReferralCommission;