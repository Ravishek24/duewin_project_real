// File: Backend/models/AttendanceRecord.js
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
          key: 'id'
        }
      },
      attendance_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      streak_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Current consecutive days streak'
      },
      // New fields start here
      has_recharged: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether user has recharged on this day'
      },
      recharge_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Amount recharged on this day'
      },
      additional_bonus: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false, 
        defaultValue: 0.00,
        comment: 'Additional bonus based on recharge amount'
      },
      bonus_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total bonus amount (streak + additional)'
      },
      bonus_claimed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether bonus has been claimed'
      },
      claim_eligible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether user is eligible to claim bonus'
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
    this.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  }
}

module.exports = AttendanceRecord;