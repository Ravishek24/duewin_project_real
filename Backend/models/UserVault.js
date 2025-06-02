// Backend/models/UserVault.js
const { Model, DataTypes } = require('sequelize');

class UserVault extends Model {
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
            vault_balance: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Current amount in vault'
            },
            total_deposited: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total amount ever deposited'
            },
            total_withdrawn: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total amount ever withdrawn'
            },
            total_interest_earned: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Total interest earned till date'
            },
            last_interest_date: {
                type: DataTypes.DATEONLY,
                allowNull: true,
                comment: 'Last date when interest was calculated'
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
            modelName: 'UserVault',
            tableName: 'user_vaults',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    unique: true,
                    fields: ['user_id']
                }
            ]
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'vaultuser'
            });
        }
        
        if (models.VaultTransaction) {
            this.hasMany(models.VaultTransaction, {
                foreignKey: 'user_id',
                sourceKey: 'user_id',
                as: 'vaultTransactions'
            });
        }
    }
}

module.exports = UserVault;