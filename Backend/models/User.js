// Backend/models/User.js - FIXED VERSION WITHOUT DUPLICATE ASSOCIATIONS
const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
            // 🔥 SPRIBE TOKEN FIELDS
            spribe_token: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Current SPRIBE authentication token'
            },
            spribe_token_created_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'When the SPRIBE token was created'
            },
            spribe_token_expires_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'When the SPRIBE token expires'
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            },
            updated_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            is_email_verified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            email_verification_token: {
                type: DataTypes.STRING,
                allowNull: true
            },
            email_verification_token_expiry: {
                type: DataTypes.DATE,
                allowNull: true
            },
            last_login_at: {
                type: DataTypes.DATE
            },
            last_login_ip: {
                type: DataTypes.STRING
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
                        exclude: ['password', 'reset_token', 'reset_token_expiry', 'phone_otp_session_id', 'spribe_token']
                    }
                },
                withPassword: {
                    attributes: {
                        include: [
                            'user_id', 'user_name', 'email', 'phone_no', 'profile_picture_id',
                            'password', 'referral_code', 'referring_code', 'wallet_balance',
                            'is_admin', 'is_phone_verified', 'is_blocked', 'block_reason',
                            'blocked_at', 'current_ip', 'registration_ip', 'phone_otp_session_id',
                            'vip_exp', 'vip_level', 'direct_referral_count', 'referral_level',
                            'reset_token', 'reset_token_expiry', 'actual_deposit_amount',
                            'bonus_amount', 'total_bet_amount', 'has_received_first_bonus',
                            'spribe_token', 'spribe_token_created_at', 'spribe_token_expires_at',
                            'created_at', 'updated_at', 'is_active', 'is_email_verified',
                            'email_verification_token', 'email_verification_token_expiry',
                            'last_login_at', 'last_login_ip'
                        ]
                    }
                },
                withSpribeToken: {
                    attributes: {
                        include: ['spribe_token', 'spribe_token_created_at', 'spribe_token_expires_at']
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
        // 🔥 FIXED: Only set up non-SPRIBE associations here
        // SPRIBE associations will be handled separately to avoid conflicts
        
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

        if (models.VipLevel) {
            this.belongsTo(models.VipLevel, {
                foreignKey: 'vip_level',
                targetKey: 'level',
                as: 'vipuser'
            });
        }

        // 🚫 REMOVED: SPRIBE associations to prevent duplicates
        // These are now handled in models/index.js separately
    }

    // Instance method to check password
    async checkPassword(password) {
        return bcrypt.compare(password, this.password);
    }

    // 🔥 SPRIBE TOKEN METHODS
    /**
     * Generate a new SPRIBE token for this user
     * @returns {string} - Generated token
     */
    generateSpribeToken() {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = 4 * 60 * 60; // 4 hours in seconds
        
        const token = jwt.sign(
            {
                userId: this.user_id,
                role: this.role,
                email: this.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: expiresIn
            }
        );
        
        // Update token metadata
        this.spribe_token = token;
        this.spribe_token_created_at = new Date(now * 1000);
        this.spribe_token_expires_at = new Date((now + expiresIn) * 1000);
        
        console.log('Generated SPRIBE token:', {
            userId: this.user_id,
            createdAt: this.spribe_token_created_at,
            expiresAt: this.spribe_token_expires_at,
            currentTime: new Date()
        });
        
        return token;
    }

    /**
     * Check if SPRIBE token is valid
     * @returns {boolean}
     */
    isSpribeTokenValid() {
        if (!this.spribe_token || !this.spribe_token_expires_at) {
            console.log('❌ SPRIBE token validation failed:', {
                hasToken: !!this.spribe_token,
                hasExpiry: !!this.spribe_token_expires_at
            });
            return false;
        }
        
        const now = new Date();
        const expiresAt = new Date(this.spribe_token_expires_at);
        const isValid = now < expiresAt;
        
        console.log('🔍 SPRIBE token validation:', {
            userId: this.user_id,
            tokenCreatedAt: this.spribe_token_created_at,
            tokenExpiresAt: this.spribe_token_expires_at,
            currentTime: now,
            isValid
        });
        
        return isValid;
    }

    /**
     * Clear SPRIBE token
     */
    clearSpribeToken() {
        this.spribe_token = null;
        this.spribe_token_created_at = null;
        this.spribe_token_expires_at = null;
    }
}

module.exports = User;