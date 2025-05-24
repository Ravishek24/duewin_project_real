// Backend/models/BetRecord5D.js
const { Model, DataTypes } = require('sequelize');

class BetRecord5D extends Model {
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
            period: {
                type: DataTypes.STRING,
                allowNull: false
            },
            bet_type: {
                type: DataTypes.STRING,
                allowNull: false
            },
            bet_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            odds: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM('pending', 'won', 'lost'),
                allowNull: false,
                defaultValue: 'pending'
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
            modelName: 'BetRecord5D',
            tableName: 'bet_record_5ds',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        // Define associations here if needed
    }
}

module.exports = BetRecord5D;