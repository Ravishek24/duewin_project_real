const gameLogicService = require('./services/gameLogicService');
const models = require('./models');
const { sequelize } = require('./config/db');

// Destructure models
const {
    BetResultWingo,
    BetResult5D,
    BetResultK3,
    BetResultTrxWix,
    GamePeriod
} = models;

async function testResultGeneration() {
    try {
        // Test durations for each game type
        const testDurations = {
            wingo: [30, 60, 180, 300],
            fiveD: [60, 180, 300, 600],
            k3: [60, 180, 300, 600]
        };

        // Test each game type
        for (const [gameType, durations] of Object.entries(testDurations)) {
            console.log(`\nTesting ${gameType} game type...`);
            
            for (const duration of durations) {
                console.log(`\nTesting duration: ${duration}s`);
                
                // Get active period for this game type and duration
                const activePeriod = await GamePeriod.findOne({
                    where: {
                        game_type: gameType,
                        duration: duration,
                        is_completed: false
                    },
                    order: [['created_at', 'DESC']]
                });

                if (!activePeriod) {
                    console.log(`No active period found for ${gameType} with duration ${duration}s`);
                    continue;
                }

                console.log(`Using active period: ${activePeriod.period_id}`);
                
                // Generate and process result
                const result = await gameLogicService.calculateOptimizedResult(gameType, duration, activePeriod.period_id);
                console.log('Generated result:', result);
                
                // Process the result
                const processResult = await gameLogicService.processGameResults(gameType, duration, activePeriod.period_id);
                console.log('Process result:', processResult);
                
                // Verify database entry
                let dbResult;
                switch (gameType) {
                    case 'wingo':
                        dbResult = await BetResultWingo.findOne({
                            where: { bet_number: activePeriod.period_id, duration: duration }
                        });
                        break;
                    case 'fiveD':
                        dbResult = await BetResult5D.findOne({
                            where: { bet_number: activePeriod.period_id, duration: duration }
                        });
                        break;
                    case 'k3':
                        dbResult = await BetResultK3.findOne({
                            where: { bet_number: activePeriod.period_id, duration: duration }
                        });
                        break;
                }
                
                if (dbResult) {
                    console.log('Database entry verified:', dbResult.toJSON());
                } else {
                    console.log('No database entry found for this test case');
                }
            }
        }
        
        console.log('\nAll tests completed successfully');
    } catch (error) {
        console.error('Error during test:', error);
        throw error;
    }
}

// Run the test
testResultGeneration()
    .then(() => {
        console.log('Test script completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('Test script failed:', error);
        process.exit(1);
    }); 