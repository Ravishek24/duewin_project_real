// Backend/models/GameConfig.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const GameConfig = sequelize.define('GameConfig', {
    config_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    game_type: {
        type: DataTypes.ENUM('wingo', 'fiveD', 'k3'),
        allowNull: false
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Duration in seconds (30, 60, 180, 300, 600)'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this game/duration is currently active'
    },
    payout_target: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 60.00,
        comment: 'Target payout percentage (e.g., 60 for 60%)'
    },
    min_bet_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 10.00,
        comment: 'Minimum bet amount allowed'
    },
    max_bet_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 10000.00,
        comment: 'Maximum bet amount allowed'
    },
    max_win_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 100000.00,
        comment: 'Maximum win amount allowed per bet'
    },
    platform_fee_percent: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 2.00,
        comment: 'Platform fee percentage to deduct from bets'
    },
    bet_close_seconds: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
        comment: 'Seconds before period end when betting closes'
    },
    payout_multipliers: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'JSON string of payout multipliers for different bet types'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Admin user ID who last updated the config'
    }
}, {
    tableName: 'game_configs',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['game_type', 'duration']
        }
    ]
});

// Helper method to get default payout multipliers for each game type
GameConfig.getDefaultMultipliers = (gameType) => {
    switch (gameType) {
        case 'wingo':
            return JSON.stringify({
                number: 9.0,        // 9x for correct number
                color: {
                    red: 2.0,       // 2x for red
                    green: 2.0,     // 2x for green
                    violet: 4.5,    // 4.5x for violet
                    red_violet: 2.0, // 2x for red-violet combo
                    green_violet: 2.0 // 2x for green-violet combo
                },
                size: 2.0,          // 2x for big/small
                parity: 2.0         // 2x for odd/even
            });
            
        case 'fiveD':
            return JSON.stringify({
                number: 9.0,        // 9x for correct number in position
                size: 2.0,          // 2x for big/small
                parity: 2.0,        // 2x for odd/even
                sum: {
                    size: 2.0,      // 2x for sum big/small
                    parity: 2.0     // 2x for sum odd/even
                }
            });
            
        case 'k3':
            return JSON.stringify({
                sum: {
                    3: 207.36, 18: 207.36,
                    4: 69.12, 17: 69.12,
                    5: 34.56, 16: 34.56,
                    6: 20.74, 15: 20.74,
                    7: 13.83, 14: 13.83,
                    8: 9.88, 13: 9.88,
                    9: 8.3, 12: 8.3,
                    10: 7.68, 11: 7.68
                },
                sum_category: {
                    big: 2.0,       // 2x for big (≥11)
                    small: 2.0,     // 2x for small (<11)
                    odd: 2.0,       // 2x for odd
                    even: 2.0       // 2x for even
                },
                matching_dice: {
                    triple_exact: 207.36, // 207.36x for specific triple (e.g., three 5s)
                    triple_any: 34.56,    // 34.56x for any triple
                    pair_any: 13.83,      // 13.83x for any pair
                    pair_specific: 69.12  // 69.12x for specific pair with specific single
                },
                number_pattern: {
                    all_different: 34.56, // 34.56x for three different numbers
                    straight: 8.64,       // 8.64x for three consecutive numbers
                    two_different: 6.91   // 6.91x for two different numbers (one pair)
                }
            });
            
        default:
            return JSON.stringify({});
    }
};

module.exports = GameConfig;