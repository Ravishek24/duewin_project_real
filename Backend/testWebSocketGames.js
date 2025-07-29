require('dotenv').config();
const unifiedRedis = require('./config/unifiedRedisManager');

async function testWebSocketGames() {
    try {
        console.log('🔄 Initializing Redis manager...');
        await unifiedRedis.initialize();
        
        const helper = unifiedRedis.getHelper();
        console.log('✅ Redis manager initialized');
        
        // Test the same games as in GAME_CONFIGS
        const GAME_CONFIGS = {
            wingo: [30, 60, 180, 300],
            trx_wix: [30, 60, 180, 300],
            fiveD: [60, 180, 300, 600],
            k3: [60, 180, 300, 600]
        };
        
        console.log('\n🔍 Testing WebSocket game processing...\n');
        
        for (const [gameType, durations] of Object.entries(GAME_CONFIGS)) {
            console.log(`📋 Testing ${gameType.toUpperCase()}:`);
            for (const duration of durations) {
                const key = `game_scheduler:${gameType}:${duration}:current`;
                const data = await helper.get(key);
                
                if (data) {
                    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                    console.log(`  ✅ ${gameType}_${duration}: EXISTS`);
                    console.log(`     - periodId: ${parsed.periodId}`);
                    console.log(`     - timeRemaining: ${parsed.timeRemaining}`);
                    console.log(`     - bettingOpen: ${parsed.bettingOpen}`);
                    
                    // Test the time calculation logic
                    const now = new Date();
                    const endTime = new Date(parsed.endTime);
                    const calculatedTimeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
                    console.log(`     - calculated timeRemaining: ${calculatedTimeRemaining}s`);
                    console.log(`     - difference: ${Math.abs(calculatedTimeRemaining - parsed.timeRemaining)}s`);
                    
                } else {
                    console.log(`  ❌ ${gameType}_${duration}: MISSING`);
                }
            }
            console.log('');
        }
        
        // Test the GAME_CONFIGS object
        console.log('🔍 Testing GAME_CONFIGS object:');
        console.log('GAME_CONFIGS:', JSON.stringify(GAME_CONFIGS, null, 2));
        
        // Test iteration
        console.log('\n🔍 Testing iteration through GAME_CONFIGS:');
        Object.entries(GAME_CONFIGS).forEach(([gameType, durations]) => {
            console.log(`  - ${gameType}: [${durations.join(', ')}]`);
            durations.forEach(duration => {
                console.log(`    * ${gameType}_${duration}`);
            });
        });
        
    } catch (error) {
        console.error('❌ Error testing WebSocket games:', error);
    } finally {
        process.exit(0);
    }
}

testWebSocketGames();