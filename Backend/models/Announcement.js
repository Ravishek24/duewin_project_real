// Backend/models/Announcement.js
const { Model, DataTypes } = require('sequelize');

class Announcement extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Title of the announcement'
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: 'Content of the announcement'
            },
            created_by: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'user_id'
                },
                comment: 'Admin user who created the announcement'
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                comment: 'Whether the announcement is currently active'
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
            modelName: 'Announcement',
            tableName: 'announcements',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['created_at']
                },
                {
                    fields: ['is_active']
                }
            ]
        });
    }

    static associate(models) {
        if (models.User) {
            this.belongsTo(models.User, {
                foreignKey: 'created_by',
                targetKey: 'user_id',
                as: 'creator'
            });
        }
    }
}

module.exports = Announcement; 