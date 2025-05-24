// Backend/models/WithdrawalAdmin.js
const { Model, DataTypes } = require('sequelize');

class WithdrawalAdmin extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            withdrawal_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'wallet_withdrawals',
                    key: 'id'
                }
            },
            admin_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'user_id'
                },
                comment: 'ID of admin who processed the approval/rejection'
            },
            status: {
                type: DataTypes.ENUM('pending', 'approved', 'rejected'),
                defaultValue: 'pending'
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'Admin notes or reason for rejection'
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            },
            updated_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            },
            processed_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'When the admin processed the withdrawal'
            }
        }, {
            sequelize,
            modelName: 'WithdrawalAdmin',
            tableName: 'withdrawal_admin',
            timestamps: false,
            indexes: [
                {
                    fields: ['withdrawal_id']
                },
                {
                    fields: ['status']
                }
            ]
        });
    }

    static associate(models) {
        // Only set up associations if models exist
        if (models.WalletWithdrawal) {
            this.belongsTo(models.WalletWithdrawal, {
                foreignKey: 'withdrawal_id',
                as: 'withdrawal'
            });
        }
        
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'admin_id',
                targetKey: 'user_id',
                as: 'ProcessedBy'
            });
        }
    }
}

module.exports = WithdrawalAdmin;