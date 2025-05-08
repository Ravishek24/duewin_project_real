// Backend/models/gameModels.js
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
    const exists = await GameConfig.findOne({
        where: { game_type: gameType, duration }
    });
    
    if (!exists) {
        await GameConfig.create({
            game_type: gameType,
            duration,
            is_active: true,
            payout_target: 60.00,
            min_bet_amount: 10.00,
            max_bet_amount: 10000.00,
            max_win_amount: 100000.00,
            platform_fee_percent: 2.00,
            bet_close_seconds: 5,
            payout_multipliers: GameConfig.getDefaultMultipliers(gameType)
        });
        
        console.log(`Created default config for ${gameType} ${duration}s`);
    }
};

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