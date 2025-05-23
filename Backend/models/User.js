const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { hashPassword } = require('../utils/password');
const bcrypt = require('bcryptjs');

// Initialize the model
const User = sequelize.define('User', {
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
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'users',
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await hashPassword(user.password);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                user.password = await hashPassword(user.password);
            }
        }
    }
});

// Define scopes
User.addScope('defaultScope', {
    attributes: {
        exclude: ['password', 'reset_token', 'reset_token_expiry', 'phone_otp_session_id']
    }
});

User.addScope('withPassword', {
    attributes: {
        include: ['password']
    }
});

User.addScope('withReferralTree', {
    include: [{
        model: sequelize.models.ReferralTree,
        required: false
    }],
    attributes: {
        exclude: ['password', 'reset_token', 'reset_token_expiry', 'phone_otp_session_id']
    }
});

// Add hook to handle actual_deposit_amount column
User.beforeFind(async (options) => {
    try {
        // Check if actual_deposit_amount column exists
        const [results] = await sequelize.query(
            "SHOW COLUMNS FROM users LIKE 'actual_deposit_amount'"
        );
        
        if (results.length === 0) {
            // If column doesn't exist, exclude it from attributes
            if (options.attributes) {
                options.attributes = options.attributes.filter(attr => 
                    attr !== 'actual_deposit_amount' && 
                    !attr.includes('actual_deposit_amount')
                );
            }
            
            // Also check includes
            if (options.include) {
                options.include = options.include.map(include => {
                    if (include.model === sequelize.models.ReferralTree) {
                        if (include.attributes) {
                            include.attributes = include.attributes.filter(attr =>
                                attr !== 'actual_deposit_amount' &&
                                !attr.includes('actual_deposit_amount')
                            );
                        }
                    }
                    return include;
                });
            }
        }
    } catch (error) {
        console.error('Error in beforeFind hook:', error);
    }
});

// Instance method to check password
User.prototype.checkPassword = async function(password) {
    return bcrypt.compare(password, this.password);
};

module.exports = User;