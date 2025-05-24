const { Model, DataTypes } = require('sequelize');

class GiftCodeClaim extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            gift_code_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'gift_codes',
                    key: 'id'
                }
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            claimed_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        }, {
            sequelize,
            modelName: 'GiftCodeClaim',
            tableName: 'gift_code_claims',
            timestamps: false
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'giftcodeclaimuser'
            });
        }
        
        if (models.GiftCode) {
            this.belongsTo(models.GiftCode, {
                foreignKey: 'gift_code_id',
                as: 'giftCode'
            });
        }
    }
}

module.exports = GiftCodeClaim; 