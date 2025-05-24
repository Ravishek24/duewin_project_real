// models/GameTransaction.js
const { Model, DataTypes } = require('sequelize');

class GameTransaction extends Model {
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
            game_type: {
                type: DataTypes.STRING,
                allowNull: false
            },
            transaction_type: {
                type: DataTypes.STRING,
                allowNull: false
            },
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            balance: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
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
            modelName: 'GameTransaction',
            tableName: 'game_transactions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'gametransactionuser'
            });
        }
        
        if (models.GameSession) {
            this.belongsTo(models.GameSession, {
                foreignKey: 'session_id',
                as: 'session'
            });
        }
    }
}

module.exports = GameTransaction;