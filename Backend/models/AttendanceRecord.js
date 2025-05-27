// models/AttendanceRecord.js
const { Model, DataTypes } = require('sequelize');

class AttendanceRecord extends Model {
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
                comment: 'Legacy date field'
            },
            attendance_date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
                comment: 'Actual attendance date for new system'
            },
            streak_count: {
                type: DataTypes.INTEGER,
                defaultValue: 1,
                comment: 'Consecutive attendance days'
            },
            has_recharged: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                comment: 'Whether user recharged on this day'
            },
            recharge_amount: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0.00,
                comment: 'Amount recharged on this day'
            },
            additional_bonus: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0.00,
                comment: 'Additional bonus based on recharge amount'
            },
            bonus_amount: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0.00,
                comment: 'Total bonus amount (streak + additional)'
            },
            bonus_claimed: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                comment: 'Whether bonus has been claimed'
            },
            claim_eligible: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                comment: 'Whether user is eligible to claim bonus'
            },
            reward: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0.00,
                comment: 'Legacy reward field'
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
            modelName: 'AttendanceRecord',
            tableName: 'attendance_records',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    unique: true,
                    fields: ['user_id', 'attendance_date']
                }
            ]
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'attendance_user'
            });
        }
    }
}

module.exports = AttendanceRecord;