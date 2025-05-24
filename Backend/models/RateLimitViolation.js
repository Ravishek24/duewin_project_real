// Backend/models/RateLimitViolation.js
const { Model, DataTypes } = require('sequelize');

class RateLimitViolation extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                field: 'user_id',
                references: {
                    model: 'users',
                    key: 'user_id'
                }
            },
            ip_address: {
                type: DataTypes.STRING,
                allowNull: false,
                field: 'ip_address'
            },
            endpoint: {
                type: DataTypes.STRING,
                allowNull: false,
                field: 'endpoint'
            },
            violation_type: {
                type: DataTypes.ENUM('IP', 'USER', 'BOTH'),
                allowNull: false,
                field: 'violation_type'
            },
            request_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
                field: 'request_count'
            },
            time_window: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'time_window'
            },
            limit: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'limit'
            },
            is_blocked: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                field: 'is_blocked'
            },
            blocked_at: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'blocked_at'
            },
            unblocked_at: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'unblocked_at'
            },
            unblocked_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
                field: 'unblocked_by',
                references: {
                    model: 'users',
                    key: 'user_id'
                }
            },
            reason: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'reason'
            },
            last_violation_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'last_violation_at'
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'created_at'
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'updated_at'
            }
        }, {
            sequelize,
            modelName: 'RateLimitViolation',
            tableName: 'rate_limit_violations',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            defaultScope: {
                attributes: {
                    include: [
                        'id',
                        'user_id',
                        'ip_address',
                        'endpoint',
                        'violation_type',
                        'request_count',
                        'time_window',
                        'limit',
                        'is_blocked',
                        'blocked_at',
                        'unblocked_at',
                        'unblocked_by',
                        'reason',
                        'last_violation_at',
                        'created_at',
                        'updated_at'
                    ]
                }
            }
        });
    }

    static associate(models) {
        // Only set up associations if User model exists and is properly initialized
        if (models.User && typeof models.User === 'function') {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'user'
            });
            
            this.belongsTo(models.User, {
                foreignKey: 'unblocked_by',
                targetKey: 'user_id',
                as: 'unblocker'
            });
        } else {
            console.warn('User model not found or not properly initialized for RateLimitViolation association');
        }
    }
}

module.exports = RateLimitViolation;