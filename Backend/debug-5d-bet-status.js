const gameLogicService = require('./services/gameLogicService');
const { ensureModelsInitialized } = require('./services/gameLogicService');

async function debug5DBetStatus() {
    console.log('🔍 [DEBUG_5D_BET_STATUS] Starting 5D bet status debug...');
    
    try {
        // Initialize models
        const models = await ensureModelsInitialized();
        
        // Test 1: Check if 5D bets exist in database
        console.log('\n📊 [DEBUG_5D_BET_STATUS] Test 1: Checking 5D bets in database...');
        const recent5DBets = await models.BetRecord5D.findAll({
            where: {
                status: 'pending'
            },
            limit: 10,
            order: [['created_at', 'DESC']]
        });
        
        console.log(`📊 [DEBUG_5D_BET_STATUS] Found ${recent5DBets.length} pending 5D bets`);
        
        if (recent5DBets.length > 0) {
            console.log('📊 [DEBUG_5D_BET_STATUS] Sample pending bets:');
            recent5DBets.slice(0, 3).forEach((bet, index) => {
                console.log(`  Bet ${index + 1}:`, {
                    betId: bet.bet_id,
                    userId: bet.user_id,
                    betNumber: bet.bet_number,
                    betType: bet.bet_type,
                    betAmount: bet.bet_amount,
                    status: bet.status,
                    createdAt: bet.created_at
                });
            });
        }
        
        // Test 2: Check recent 5D results
        console.log('\n📊 [DEBUG_5D_BET_STATUS] Test 2: Checking recent 5D results...');
        const recent5DResults = await models.BetResult5D.findAll({
            limit: 5,
            order: [['created_at', 'DESC']]
        });
        
        console.log(`📊 [DEBUG_5D_BET_STATUS] Found ${recent5DResults.length} recent 5D results`);
        
        if (recent5DResults.length > 0) {
            console.log('📊 [DEBUG_5D_BET_STATUS] Sample results:');
            recent5DResults.slice(0, 3).forEach((result, index) => {
                console.log(`  Result ${index + 1}:`, {
                    betId: result.bet_id,
                    betNumber: result.bet_number,
                    resultA: result.result_a,
                    resultB: result.result_b,
                    resultC: result.result_c,
                    resultD: result.result_d,
                    resultE: result.result_e,
                    totalSum: result.total_sum,
                    createdAt: result.created_at
                });
            });
        }
        
        // Test 3: Check if there are any processed bets (won/lost)
        console.log('\n📊 [DEBUG_5D_BET_STATUS] Test 3: Checking processed 5D bets...');
        const processed5DBets = await models.BetRecord5D.findAll({
            where: {
                status: ['won', 'lost']
            },
            limit: 10,
            order: [['updated_at', 'DESC']]
        });
        
        console.log(`📊 [DEBUG_5D_BET_STATUS] Found ${processed5DBets.length} processed 5D bets`);
        
        if (processed5DBets.length > 0) {
            console.log('📊 [DEBUG_5D_BET_STATUS] Sample processed bets:');
            processed5DBets.slice(0, 3).forEach((bet, index) => {
                console.log(`  Processed Bet ${index + 1}:`, {
                    betId: bet.bet_id,
                    userId: bet.user_id,
                    betNumber: bet.bet_number,
                    betType: bet.bet_type,
                    status: bet.status,
                    winAmount: bet.win_amount,
                    payout: bet.payout,
                    updatedAt: bet.updated_at
                });
            });
        }
        
        // Test 4: Check if there's a mismatch between results and bet processing
        console.log('\n📊 [DEBUG_5D_BET_STATUS] Test 4: Checking for result-bet mismatch...');
        if (recent5DResults.length > 0 && recent5DBets.length > 0) {
            const latestResult = recent5DResults[0];
            const betsForLatestResult = await models.BetRecord5D.findAll({
                where: {
                    bet_number: latestResult.bet_number
                }
            });
            
            console.log(`📊 [DEBUG_5D_BET_STATUS] For result period ${latestResult.bet_number}:`);
            console.log(`  - Result exists: ✅`);
            console.log(`  - Bets found: ${betsForLatestResult.length}`);
            
            const pendingBets = betsForLatestResult.filter(bet => bet.status === 'pending');
            const processedBets = betsForLatestResult.filter(bet => ['won', 'lost'].includes(bet.status));
            
            console.log(`  - Pending bets: ${pendingBets.length}`);
            console.log(`  - Processed bets: ${processedBets.length}`);
            
            if (pendingBets.length > 0) {
                console.log('⚠️ [DEBUG_5D_BET_STATUS] ISSUE FOUND: There are pending bets for a period that has a result!');
                console.log('⚠️ [DEBUG_5D_BET_STATUS] This indicates bet processing is not working correctly.');
            }
        }
        
        // Test 5: Compare with other games
        console.log('\n📊 [DEBUG_5D_BET_STATUS] Test 5: Comparing with other games...');
        
        // Check Wingo bets
        const recentWingoBets = await models.BetRecordWingo.findAll({
            where: {
                status: ['won', 'lost']
            },
            limit: 5,
            order: [['updated_at', 'DESC']]
        });
        
        console.log(`📊 [DEBUG_5D_BET_STATUS] Recent processed Wingo bets: ${recentWingoBets.length}`);
        
        // Check K3 bets
        const recentK3Bets = await models.BetRecordK3.findAll({
            where: {
                status: ['won', 'lost']
            },
            limit: 5,
            order: [['updated_at', 'DESC']]
        });
        
        console.log(`📊 [DEBUG_5D_BET_STATUS] Recent processed K3 bets: ${recentK3Bets.length}`);
        
        console.log('\n🔍 [DEBUG_5D_BET_STATUS] Debug completed.');
        
    } catch (error) {
        console.error('❌ [DEBUG_5D_BET_STATUS] Error during debug:', error);
    }
}

// Run the debug
debug5DBetStatus().then(() => {
    console.log('✅ [DEBUG_5D_BET_STATUS] Debug script completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ [DEBUG_5D_BET_STATUS] Debug script failed:', error);
    process.exit(1);
}); 