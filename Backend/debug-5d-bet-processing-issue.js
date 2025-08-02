const gameLogicService = require('./services/gameLogicService');
const { ensureModelsInitialized } = require('./services/gameLogicService');

async function debug5DBetProcessingIssue() {
    console.log('🔍 [DEBUG_5D_BET_PROCESSING_ISSUE] Starting 5D bet processing issue debug...');
    
    try {
        // Initialize models
        const models = await ensureModelsInitialized();
        
        // Step 1: Find a recent 5D result and its corresponding bets
        console.log('\n📊 [DEBUG_5D_BET_PROCESSING_ISSUE] Step 1: Finding recent 5D result and bets...');
        
        const recentResult = await models.BetResult5D.findOne({
            order: [['created_at', 'DESC']]
        });
        
        if (!recentResult) {
            console.log('❌ [DEBUG_5D_BET_PROCESSING_ISSUE] No 5D results found!');
            return;
        }
        
        console.log('📊 [DEBUG_5D_BET_PROCESSING_ISSUE] Recent result found:', {
            betNumber: recentResult.bet_number,
            resultA: recentResult.result_a,
            resultB: recentResult.result_b,
            resultC: recentResult.result_c,
            resultD: recentResult.result_d,
            resultE: recentResult.result_e,
            totalSum: recentResult.total_sum,
            createdAt: recentResult.created_at
        });
        
        // Step 2: Check if there are pending bets for this period
        const pendingBets = await models.BetRecord5D.findAll({
            where: {
                bet_number: recentResult.bet_number,
                status: 'pending'
            }
        });
        
        console.log(`📊 [DEBUG_5D_BET_PROCESSING_ISSUE] Found ${pendingBets.length} pending bets for period ${recentResult.bet_number}`);
        
        if (pendingBets.length === 0) {
            console.log('⚠️ [DEBUG_5D_BET_PROCESSING_ISSUE] No pending bets found for this period');
            
            // Check if there are any processed bets
            const processedBets = await models.BetRecord5D.findAll({
                where: {
                    bet_number: recentResult.bet_number,
                    status: ['won', 'lost']
                }
            });
            
            console.log(`📊 [DEBUG_5D_BET_PROCESSING_ISSUE] Found ${processedBets.length} processed bets for this period`);
            
            if (processedBets.length > 0) {
                console.log('✅ [DEBUG_5D_BET_PROCESSING_ISSUE] Bets were already processed for this period');
                return;
            }
        }
        
        // Step 3: Test the processWinningBetsWithTimeline function directly
        console.log('\n🧪 [DEBUG_5D_BET_PROCESSING_ISSUE] Step 3: Testing processWinningBetsWithTimeline function...');
        
        const result = {
            A: recentResult.result_a,
            B: recentResult.result_b,
            C: recentResult.result_c,
            D: recentResult.result_d,
            E: recentResult.result_e,
            sum: recentResult.total_sum
        };
        
        console.log('🧪 [DEBUG_5D_BET_PROCESSING_ISSUE] Testing with result:', result);
        
        try {
            // Test the function directly
            const winners = await gameLogicService.processWinningBetsWithTimeline(
                '5d',
                60, // duration
                recentResult.bet_number,
                'default', // timeline
                result,
                null // transaction
            );
            
            console.log('✅ [DEBUG_5D_BET_PROCESSING_ISSUE] processWinningBetsWithTimeline executed successfully');
            console.log(`📊 [DEBUG_5D_BET_PROCESSING_ISSUE] Winners found: ${winners.length}`);
            
            // Check if bets were actually processed
            const updatedBets = await models.BetRecord5D.findAll({
                where: {
                    bet_number: recentResult.bet_number,
                    status: ['won', 'lost']
                }
            });
            
            console.log(`📊 [DEBUG_5D_BET_PROCESSING_ISSUE] Updated bets count: ${updatedBets.length}`);
            
            if (updatedBets.length > 0) {
                console.log('✅ [DEBUG_5D_BET_PROCESSING_ISSUE] Bet processing is working!');
                console.log('📊 [DEBUG_5D_BET_PROCESSING_ISSUE] Sample updated bet:', {
                    betId: updatedBets[0].bet_id,
                    status: updatedBets[0].status,
                    winAmount: updatedBets[0].win_amount,
                    payout: updatedBets[0].payout
                });
            } else {
                console.log('❌ [DEBUG_5D_BET_PROCESSING_ISSUE] Bet processing failed - no bets were updated');
            }
            
        } catch (error) {
            console.error('❌ [DEBUG_5D_BET_PROCESSING_ISSUE] Error in processWinningBetsWithTimeline:', error.message);
            console.error('❌ [DEBUG_5D_BET_PROCESSING_ISSUE] Error stack:', error.stack);
        }
        
        // Step 4: Check if there are any JavaScript syntax errors
        console.log('\n🔍 [DEBUG_5D_BET_PROCESSING_ISSUE] Step 4: Checking for syntax errors...');
        
        try {
            // Test if the function can be called without errors
            const testFunction = gameLogicService.processWinningBetsWithTimeline;
            console.log('✅ [DEBUG_5D_BET_PROCESSING_ISSUE] Function exists and is callable');
        } catch (error) {
            console.error('❌ [DEBUG_5D_BET_PROCESSING_ISSUE] Function has syntax errors:', error.message);
        }
        
    } catch (error) {
        console.error('❌ [DEBUG_5D_BET_PROCESSING_ISSUE] Debug failed:', error.message);
        console.error('❌ [DEBUG_5D_BET_PROCESSING_ISSUE] Error stack:', error.stack);
    }
}

// Run the debug
debug5DBetProcessingIssue().then(() => {
    console.log('\n🔍 [DEBUG_5D_BET_PROCESSING_ISSUE] Debug completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ [DEBUG_5D_BET_PROCESSING_ISSUE] Debug failed:', error.message);
    process.exit(1);
}); 