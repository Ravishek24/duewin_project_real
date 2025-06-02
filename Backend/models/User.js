// Backend/models/User.js
const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

class User extends Model {
    static init(sequelize) {
        return super.init({
            user_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_name: {
                type: DataTypes.STRING,
                allowNull: true,
                unique: true,
                defaultValue: () => `user_${Date.now().toString().slice(-8)}`
            },
            email: {
                type: DataTypes.STRING,
                allowNull: true,
                unique: true,
                validate: {
                    isEmail: true
                }
            },
            phone_no: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                validate: {
                    len: [10, 15]
                }
            },
            profile_picture_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
                comment: 'Profile picture ID (1-based index)'
            },
            password: {
                type: DataTypes.STRING,
                allowNull: false
            },
            referral_code: {
                type: DataTypes.STRING,
                allowNull: true
            },
            referring_code: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            wallet_balance: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0.00
            },
            is_admin: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            is_phone_verified: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            is_blocked: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            block_reason: {
                type: DataTypes.STRING,
                allowNull: true
            },
            blocked_at: {
                type: DataTypes.DATE,
                allowNull: true
            },
            current_ip: {
                type: DataTypes.STRING,
                allowNull: true
            },
            registration_ip: {
                type: DataTypes.STRING,
                allowNull: true
            },
            phone_otp_session_id: {
                type: DataTypes.STRING,
                allowNull: true
            },
            vip_exp: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            vip_level: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            direct_referral_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            referral_level: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            reset_token: {
                type: DataTypes.STRING,
                allowNull: true
            },
            reset_token_expiry: {
                type: DataTypes.DATE,
                allowNull: true
            },
            actual_deposit_amount: {
                type: DataTypes.DECIMAL(15, 2),
                defaultValue: 0.00
            },
            bonus_amount: {
                type: DataTypes.DECIMAL(15, 2),
                defaultValue: 0.00
            },
            total_bet_amount: {
                type: DataTypes.DECIMAL(15, 2),
                defaultValue: 0.00
            },
            has_received_first_bonus: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
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
            modelName: 'User',
            tableName: 'users',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            scopes: {
                defaultScope: {
                    attributes: {
                        exclude: ['password', 'reset_token', 'reset_token_expiry', 'phone_otp_session_id']
                    }
                },
                withPassword: {
                    attributes: {
                        include: ['password']
                    }
                }
            },
            hooks: {
                beforeCreate: async (user) => {
                    if (user.password) {
                        const salt = await bcrypt.genSalt(10);
                        user.password = await bcrypt.hash(user.password, salt);
                    }
                },
                beforeUpdate: async (user) => {
                    if (user.changed('password')) {
                        const salt = await bcrypt.genSalt(10);
                        user.password = await bcrypt.hash(user.password, salt);
                    }
                }
            }
        });
    }

    static associate(models) {
        // User associations will be set up here if needed
        if (models.AttendanceRecord) {
            this.hasMany(models.AttendanceRecord, {
                foreignKey: 'user_id',
                sourceKey: 'user_id',
                as: 'attendanceRecords'
            });
        }
        
        if (models.ThirdPartyWallet) {
            this.hasOne(models.ThirdPartyWallet, {
                foreignKey: 'user_id',
                sourceKey: 'user_id',
                as: 'thirdPartyWallet'
            });
        }
    }

    // Instance method to check password
    async checkPassword(password) {
        return bcrypt.compare(password, this.password);
    }
}

module.exports = User;