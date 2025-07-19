// Backend/models/gameModels.js
const { Model, DataTypes } = require('sequelize');

// This file exports multiple game-related models
class GameModels extends Model {
    static init(sequelize) {
        // This is a utility class, not a database model
        // So we don't actually initialize it as a Sequelize model
        return null;
    }
}

// Export individual model classes
const BetRecordWingo = require('./BetRecordWingo');
const BetResultWingo = require('./BetResultWingo');
const BetRecord5D = require('./BetRecord5D');
const BetResult5D = require('./BetResult5D');
const BetRecordK3 = require('./BetRecordK3');
const BetResultK3 = require('./BetResultK3');
const GamePeriod = require('./GamePeriod');
const GameConfig = require('./GameConfig');

// Initialize default game configurations if they don't exist
const initializeGameConfigs = async () => {
    try {
        // Wingo game configs
        await createDefaultConfigIfNotExists('wingo', 30);
        await createDefaultConfigIfNotExists('wingo', 60);
        await createDefaultConfigIfNotExists('wingo', 180);
        await createDefaultConfigIfNotExists('wingo', 300);
        
        // 5D game configs
        await createDefaultConfigIfNotExists('fiveD', 60);
        await createDefaultConfigIfNotExists('fiveD', 180);
        await createDefaultConfigIfNotExists('fiveD', 300);
        await createDefaultConfigIfNotExists('fiveD', 600);
        
        // K3 game configs
        await createDefaultConfigIfNotExists('k3', 60);
        await createDefaultConfigIfNotExists('k3', 180);
        await createDefaultConfigIfNotExists('k3', 300);
        await createDefaultConfigIfNotExists('k3', 600);
        
        console.log('✅ Game configurations initialized');
    } catch (error) {
        console.error('❌ Error initializing game configurations:', error);
    }
};

// Helper to create default config for a game type and duration
const createDefaultConfigIfNotExists = async (gameType, duration) => {
    try {
        if (!GameConfig || typeof GameConfig.findOne !== 'function') {
            console.warn('GameConfig model not available for initialization');
            return;
        }
        
        const exists = await GameConfig.findOne({
            where: { game_type: gameType, duration }
        });
        
        if (!exists) {
            await GameConfig.create({
                game_type: gameType,
                duration,
                is_active: true,
                payout_target: 60.00,
                min_bet_amount: 0.97,
                max_bet_amount: 10000.00,
                max_win_amount: 100000.00,
                platform_fee_percent: 2.00,
                bet_close_seconds: 5,
                payout_multipliers: GameConfig.getDefaultMultipliers ? GameConfig.getDefaultMultipliers(gameType) : '{}'
            });
            
            console.log(`Created default config for ${gameType} ${duration}s`);
        }
    } catch (error) {
        console.error(`Error creating default config for ${gameType} ${duration}s:`, error.message);
    }
};

// Export as individual models for the model loader
module.exports = {
    BetRecordWingo,
    BetResultWingo,
    BetRecord5D,
    BetResult5D,
    BetRecordK3,
    BetResultK3,
    GamePeriod,
    GameConfig,
    initializeGameConfigs
};