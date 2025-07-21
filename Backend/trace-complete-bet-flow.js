let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


const gameLogicService = require('./services/gameLogicService');


// Enhanced logging wrapper
const createTracer = (functionName, originalFunction) => {
    return async (...args) => {
        const startTime = Date.now();
        console.log(`\n🔍 [${functionName}] ==========================================`);
        console.log(`🔍 [${functionName}] ENTRY - Arguments:`, JSON.stringify(args, null, 2));
        
        try {
            const result = await originalFunction.apply(this, args);
            const duration = Date.now() - startTime;
            
            console.log(`✅ [${functionName}] SUCCESS - Duration: ${duration}ms`);
            console.log(`✅ [${functionName}] Result:`, JSON.stringify(result, null, 2));
            console.log(`✅ [${functionName}] ==========================================\n`);
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.log(`❌ [${functionName}] ERROR - Duration: ${duration}ms`);
            console.log(`❌ [${functionName}] Error:`, error.message);
            console.log(`❌ [${functionName}] Stack:`, error.stack);
            console.log(`❌ [${functionName}] ==========================================\n`);
            
            throw error;
        }
    };
};

// Function to check Redis data at any point
const checkRedisData = async (stepName, gameType, duration, timeline, periodId, redisClient) => {
    console.log(`\n📊 [REDIS_CHECK_${stepName}] ==========================================`);
    try {
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        
        const exposureData = await redisClient.hGetAll(exposureKey);
        const betsData = await redisClient.hGetAll(betsKey);
        
        console.log(`📊 [REDIS_CHECK_${stepName}] Exposure Key: ${exposureKey}`);
        console.log(`📊 [REDIS_CHECK_${stepName}] Exposure Data:`, exposureData);
        console.log(`📊 [REDIS_CHECK_${stepName}] Exposure Count: ${Object.keys(exposureData).length}`);
        
        console.log(`📊 [REDIS_CHECK_${stepName}] Bets Key: ${betsKey}`);
        console.log(`📊 [REDIS_CHECK_${stepName}] Bets Data:`, betsData);
        console.log(`📊 [REDIS_CHECK_${stepName}] Bets Count: ${Object.keys(betsData).length}`);
        
        // Check if exposure looks correct
        if (Object.keys(exposureData).length > 0) {
            console.log(`✅ [REDIS_CHECK_${stepName}] Exposure data exists!`);
            const redNumbers = [0, 2, 4, 6, 8];
            const redExposures = redNumbers.filter(num => exposureData[`number:${num}`]);
            console.log(`🔴 [REDIS_CHECK_${stepName}] RED numbers with exposure: ${redExposures.length}/5`);
        } else {
            console.log(`❌ [REDIS_CHECK_${stepName}] NO exposure data found!`);
        }
        
    } catch (error) {
        console.log(`❌ [REDIS_CHECK_${stepName}] Redis check failed:`, error.message);
    }
    console.log(`📊 [REDIS_CHECK_${stepName}] ==========================================\n`);
};

// Function to trace the complete bet flow
async function traceCompleteBetFlow() {
    console.log('🚀 TRACING COMPLETE REAL BET FLOW');
    console.log('==================================\n');
    
    // Create Redis client for this trace
    const redisClient = 
    
    await redisClient.connect();
    console.log('✅ Redis connected for tracing');
    
    const betData = {
        userId: 13,
        gameType: 'wingo',
        duration: 30,
        timeline: 'default',
        periodId: '20250706TRACE001',
        betType: 'COLOR',
        betValue: 'red',
        betAmount: 100,
        odds: 2
    };
    
    try {
        console.log('🎯 [FLOW_START] Starting bet flow trace with data:', JSON.stringify(betData, null, 2));
        
        // Step 1: Initialize and clear data
        console.log('\n🧹 [STEP_0] Initializing and clearing test data...');
        await gameLogicService.initializeGameCombinations();
        
        const exposureKey = `exposure:${betData.gameType}:${betData.duration}:${betData.timeline}:${betData.periodId}`;
        const betsKey = `bets:${betData.gameType}:${betData.duration}:${betData.timeline}:${betData.periodId}`;
        await redisClient.del(exposureKey);
        await redisClient.del(betsKey);
        console.log('✅ [STEP_0] Initialization complete');
        
        await checkRedisData('INITIAL', betData.gameType, betData.duration, betData.timeline, betData.periodId, redisClient);
        
        // Step 2: Trace validateBetWithTimeline
        console.log('\n🎯 [STEP_1] Tracing validateBetWithTimeline...');
        const validation = await createTracer('validateBetWithTimeline', gameLogicService.validateBetWithTimeline)(betData);
        
        if (!validation.valid) {
            console.log('❌ [STEP_1] Validation failed, stopping trace');
            return;
        }
        
        await checkRedisData('AFTER_VALIDATION', betData.gameType, betData.duration, betData.timeline, betData.periodId, redisClient);
        
        // Step 3: Prepare the exact data that processBet will use
        const { grossBetAmount, platformFee, netBetAmount } = validation.amounts;
        const betTypeFormatted = `${betData.betType}:${betData.betValue}`;
        
        console.log('\n📊 [STEP_2] Bet processing data preparation:');
        console.log(`   - Original bet data:`, JSON.stringify(betData, null, 2));
        console.log(`   - Validation amounts:`, { grossBetAmount, platformFee, netBetAmount });
        console.log(`   - Formatted bet type: ${betTypeFormatted}`);
        
        // Step 4: Trace the data that will be passed to storeBetInRedisWithTimeline
        const redisStoreData = {
            ...betData,
            grossBetAmount,
            platformFee,
            netBetAmount,
            betAmount: netBetAmount,
            // CRITICAL: The fix data
            bet_type: betTypeFormatted,
            amount_after_tax: netBetAmount
        };
        
        console.log('\n🎯 [STEP_3] Tracing storeBetInRedisWithTimeline with data:');
        console.log(JSON.stringify(redisStoreData, null, 2));
        
        const redisStored = await createTracer('storeBetInRedisWithTimeline', gameLogicService.storeBetInRedisWithTimeline)(redisStoreData);
        
        await checkRedisData('AFTER_REDIS_STORE', betData.gameType, betData.duration, betData.timeline, betData.periodId, redisClient);
        
        // Step 5: Trace updateBetExposure directly with the exact data it receives
        console.log('\n🎯 [STEP_4] Tracing updateBetExposure directly...');
        
        // First check what data updateBetExposure actually gets
        const exposureUpdateData = {
            bet_type: betTypeFormatted,
            amount_after_tax: netBetAmount,
            netBetAmount,
            odds: betData.odds
        };
        
        console.log('📊 [STEP_4] Data passed to updateBetExposure:', JSON.stringify(exposureUpdateData, null, 2));
        
        const exposureResult = await createTracer('updateBetExposure', gameLogicService.updateBetExposure)(
            betData.gameType,
            betData.duration,
            betData.periodId,
            exposureUpdateData,
            betData.timeline
        );
        
        await checkRedisData('AFTER_EXPOSURE_UPDATE', betData.gameType, betData.duration, betData.timeline, betData.periodId, redisClient);
        
        // Step 6: Test protection logic
        console.log('\n🎯 [STEP_5] Testing protection logic...');
        const userCount = await createTracer('getUniqueUserCount', gameLogicService.getUniqueUserCount)(
            betData.gameType, betData.duration, betData.periodId, betData.timeline
        );
        
        console.log(`👥 [STEP_5] User count: ${userCount}, Protection threshold: 100`);
        
        if (userCount < 100) {
            console.log('🛡️ [STEP_5] Protection should be active, testing selectProtectedResultWithExposure...');
            const protectedResult = await createTracer('selectProtectedResultWithExposure', gameLogicService.selectProtectedResultWithExposure)(
                betData.gameType, betData.duration, betData.periodId, betData.timeline
            );
            
            if (protectedResult) {
                console.log(`🛡️ [STEP_5] Protection selected: Number ${protectedResult.number}, Color ${protectedResult.color}`);
                
                // Step 7: Test win logic
                console.log('\n🎯 [STEP_6] Testing win logic...');
                const testBet = {
                    user_id: betData.userId,
                    bet_type: betTypeFormatted,
                    amount_after_tax: netBetAmount
                };
                
                const winResult = await createTracer('checkBetWin', gameLogicService.checkBetWin)(
                    testBet, protectedResult, betData.gameType
                );
                
                console.log(`🎯 [STEP_6] Win check: User bets ${betData.betValue.toUpperCase()}, result is ${protectedResult.color.toUpperCase()} → User wins: ${winResult}`);
                
                if (winResult) {
                    console.log('❌ [STEP_6] BUG FOUND: User should LOSE but wins!');
                } else {
                    console.log('✅ [STEP_6] CORRECT: User loses as expected!');
                }
            } else {
                console.log('❌ [STEP_5] Protection returned null result');
            }
        } else {
            console.log('ℹ️ [STEP_5] User count >= 100, protection not active');
        }
        
        console.log('\n🎉 [FLOW_COMPLETE] Complete flow trace finished!');
        console.log('========================================');
        
    } catch (error) {
        console.error('❌ [FLOW_ERROR] Flow trace failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await redisClient.quit();
        console.log('🔌 Redis connection closed');
    }
}

// Add Redis connection check
async function initializeTracer() {
    try {
        await traceCompleteBetFlow();
    } catch (error) {
        console.error('❌ Tracer initialization failed:', error.message);
    }
}

// Run the tracer
initializeTracer().catch(console.error); 
module.exports = { setRedisHelper };
