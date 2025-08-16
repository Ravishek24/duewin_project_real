const { Model, DataTypes } = require('sequelize');

class BankAccount extends Model {
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
            bank_name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            account_number: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: 'Bank account number - must be unique across all users'
            },
            account_holder: {
                type: DataTypes.STRING,
                allowNull: false
            },
            ifsc_code: {
                type: DataTypes.STRING,
                allowNull: false
            },
            is_primary: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
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
            modelName: 'BankAccount',
            tableName: 'bank_accounts',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'accountuser'
            });
        }
    }
}

module.exports = BankAccount;