const { Model, DataTypes } = require('sequelize');

class GiftCode extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            code: {
                type: DataTypes.STRING,
                unique: true,
                allowNull: false
            },
            total_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false
            },
            max_claims: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            claimed_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            amount_per_user: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false
            },
            created_by: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        }, {
            sequelize,
            modelName: 'GiftCode',
            tableName: 'gift_codes',
            timestamps: false
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });
        }
        
        if (models.GiftCodeClaim) {
            this.hasMany(models.GiftCodeClaim, {
                foreignKey: 'gift_code_id',
                as: 'claims'
            });
        }
    }
}

module.exports = GiftCode; 