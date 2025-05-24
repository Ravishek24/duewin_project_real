// Backend/models/OtpRequest.js
const { Model, DataTypes } = require('sequelize');

class OtpRequest extends Model {
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
            phone_no: {
                type: DataTypes.STRING,
                allowNull: false
            },
            otp_session_id: {
                type: DataTypes.STRING,
                allowNull: false
            },
            request_type: {
                type: DataTypes.ENUM('forgot_password', 'phone_update', 'bank_account', 'admin_login'),
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM('pending', 'verified', 'expired'),
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
            modelName: 'OtpRequest',
            tableName: 'otp_requests',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        // Only set up association if User model exists and is properly initialized
        if (models.User && typeof models.User === 'function') {
            this.belongsTo(models.User, {
                foreignKey: 'user_id',
                targetKey: 'user_id',
                as: 'user'
            });
        } else {
            console.warn('User model not found or not properly initialized for OtpRequest association');
        }
    }
}

module.exports = OtpRequest;