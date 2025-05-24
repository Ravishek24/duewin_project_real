// models/ReferralTree.js
const { Model, DataTypes } = require('sequelize');

class ReferralTree extends Model {
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
                unique: true,
                references: {
                    model: 'users',
                    key: 'user_id'
                }
            },
            referrer_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'user_id'
                }
            },
            level_1: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            level_2: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            level_3: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            level_4: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            level_5: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            level_6: {
                type: DataTypes.TEXT,
                allowNull: true
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
            modelName: 'ReferralTree',
            tableName: 'referral_trees',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'referraltreeuser'
            });
            
            this.belongsTo(models.User, {
                foreignKey: 'referrer_id',
                targetKey: 'user_id',
                as: 'referrer'
            });
        }
    }
}

module.exports = ReferralTree;