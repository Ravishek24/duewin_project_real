// Backend/models/Feedback.js
const { Model, DataTypes } = require('sequelize');

class Feedback extends Model {
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
                },
                comment: 'User who submitted the feedback'
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: 'Content of the feedback'
            },
            status: {
                type: DataTypes.ENUM('pending', 'read', 'responded'),
                defaultValue: 'pending',
                comment: 'Status of the feedback'
            },
            admin_response: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'Admin response to the feedback'
            },
            responded_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'user_id'
                },
                comment: 'Admin who responded to the feedback'
            },
            responded_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'When the admin responded'
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
            modelName: 'Feedback',
            tableName: 'feedbacks',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['created_at']
                }
            ]
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'user'
            });
            this.belongsTo(models.User, {
                foreignKey: 'responded_by',
                targetKey: 'user_id',
                as: 'responder'
            });
        }
    }
}

module.exports = Feedback; 