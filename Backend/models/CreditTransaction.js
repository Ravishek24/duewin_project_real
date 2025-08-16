// Backend/models/CreditTransaction.js
const { Model, DataTypes } = require('sequelize');

class CreditTransaction extends Model {
    static init(sequelize) {
        return super.init({
            credit_id: {
                type: DataTypes.STRING,
                primaryKey: true,
                comment: 'Unique credit transaction identifier'
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: 'User who received the credit'
            },
            amount: {
                type: DataTypes.DECIMAL(20, 8),
                allowNull: false,
                comment: 'Credit amount (positive for addition, negative for usage)'
            },
            credit_type: {
                type: DataTypes.ENUM('admin_bonus', 'referral_reward', 'welcome_bonus', 'promotional', 'vip_reward', 'activity_reward', 'betting_rebate', 'cashback', 'loyalty_reward', 'credit_usage'),
                allowNull: false,
                comment: 'Type of credit transaction'
            },
            source: {
                type: DataTypes.ENUM('external', 'admin', 'system', 'self', 'betting_activity'),
                allowNull: false,
                comment: 'Source of the credit'
            },
            reference_id: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Reference to what triggered this credit'
            },
            is_external_credit: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                comment: 'Whether this credit affects wagering requirement'
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'Additional description of the credit'
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        }, {
            sequelize,
            modelName: 'CreditTransaction',
            tableName: 'credit_transactions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id']
                },
                {
                    fields: ['credit_type']
                },
                {
                    fields: ['source']
                },
                {
                    fields: ['created_at']
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

    // Helper method to check if credit affects wagering
    affectsWagering() {
        return this.is_external_credit && this.amount > 0;
    }

    // Helper method to get credit category
    getCreditCategory() {
        if (this.credit_type === 'betting_rebate' || this.credit_type === 'cashback' || this.credit_type === 'loyalty_reward') {
            return 'self_rebate';
        }
        return 'external_credit';
    }
}

module.exports = CreditTransaction;
