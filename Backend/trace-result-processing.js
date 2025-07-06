const gameLogicService = require('./services/gameLogicService');
const redis = require('redis');

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

// Function to trace result processing flow
async function traceResultProcessing() {
    console.log('🚀 TRACING RESULT PROCESSING FLOW');
    console.log('==================================\n');
    
    // Create Redis client for this trace
    const redisClient = redis.createClient({
        host: 'localhost',
        port: 6379,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
    });
    
    await redisClient.connect();
    console.log('✅ Redis connected for tracing');
    
    const testData = {
        gameType: 'wingo',
        duration: 30,
        timeline: 'default',
        periodId: '20250706RESULT001'
    };
    
    try {
        console.log('🎯 [RESULT_START] Starting result processing trace...');
        
        // Step 1: Initialize and place a bet first
        console.log('\n🧹 [STEP_0] Initializing and placing test bet...');
        await gameLogicService.initializeGameCombinations();
        
        const exposureKey = `exposure:${testData.gameType}:${testData.duration}:${testData.timeline}:${testData.periodId}`;
        const betsKey = `bets:${testData.gameType}:${testData.duration}:${testData.timeline}:${testData.periodId}`;
        await redisClient.del(exposureKey);
        await redisClient.del(betsKey);
        
        // Place a test bet
        const betData = {
            userId: 13,
            gameType: 'wingo',
            duration: 30,
            timeline: 'default',
            periodId: testData.periodId,
            betType: 'COLOR',
            betValue: 'red',
            betAmount: 100,
            odds: 2
        };
        
        const betResult = await gameLogicService.processBet(betData);
        console.log('✅ [STEP_0] Test bet placed:', betResult.success ? 'SUCCESS' : 'FAILED');
        
        await checkRedisData('AFTER_BET', testData.gameType, testData.duration, testData.timeline, testData.periodId, redisClient);
        
        // Step 2: Trace calculateResultWithVerification
        console.log('\n🎯 [STEP_1] Tracing calculateResultWithVerification...');
        const calculatedResult = await createTracer('calculateResultWithVerification', gameLogicService.calculateResultWithVerification)(
            testData.gameType,
            testData.duration,
            testData.periodId,
            testData.timeline
        );
        
        console.log(`🎲 [STEP_1] Calculated result: Number ${calculatedResult.number}, Color ${calculatedResult.color}`);
        
        // Step 3: Trace processGameResults
        console.log('\n🎯 [STEP_2] Tracing processGameResults...');
        const processResult = await createTracer('processGameResults', gameLogicService.processGameResults)(
            testData.gameType,
            testData.duration,
            testData.periodId,
            testData.timeline
        );
        
        console.log(`🎲 [STEP_2] Process result:`, processResult.success ? 'SUCCESS' : 'FAILED');
        
        // Step 4: Check what happens to the bet after result processing
        console.log('\n🎯 [STEP_3] Checking bet status after result processing...');
        
        // Get all bets for this period
        const allBets = await gameLogicService.getBetsFromHash(
            testData.gameType,
            testData.duration,
            testData.periodId,
            testData.timeline
        );
        
        console.log(`📊 [STEP_3] Total bets in period: ${allBets.length}`);
        
        if (allBets.length > 0) {
            const userBet = allBets.find(bet => bet.userId === 13);
            if (userBet) {
                console.log(`📊 [STEP_3] User 13 bet:`, JSON.stringify(userBet, null, 2));
                
                // Test win check with the actual result
                const finalResult = processResult.result || calculatedResult;
                const winCheck = await createTracer('checkBetWin', gameLogicService.checkBetWin)(
                    userBet, finalResult, testData.gameType
                );
                
                console.log(`🎯 [STEP_3] Win check with final result: User bets ${userBet.betValue.toUpperCase()}, result is ${finalResult.color.toUpperCase()} → User wins: ${winCheck}`);
                
                if (winCheck) {
                    console.log('❌ [STEP_3] BUG FOUND: User incorrectly wins!');
                } else {
                    console.log('✅ [STEP_3] CORRECT: User loses as expected!');
                }
            }
        }
        
        // Step 5: Check if there are multiple result processing systems
        console.log('\n🎯 [STEP_4] Checking for multiple result processing systems...');
        
        // Check if there are any other result processing functions
        const resultFunctions = [
            'endRound',
            'processWinningBets',
            'processWinningBetsWithTimeline',
            'selectProtectedResultWithExposure',
            'getOptimalResultByExposure'
        ];
        
        for (const funcName of resultFunctions) {
            if (gameLogicService[funcName]) {
                console.log(`✅ [STEP_4] Found result function: ${funcName}`);
            } else {
                console.log(`❌ [STEP_4] Missing result function: ${funcName}`);
            }
        }
        
        // Step 6: Check database for bet records
        console.log('\n🎯 [STEP_5] Checking database bet records...');
        try {
            const models = await gameLogicService.ensureModelsInitialized();
            const betRecord = await models.BetRecordWingo.findOne({
                where: {
                    bet_number: testData.periodId,
                    user_id: 13
                }
            });
            
            if (betRecord) {
                console.log(`📊 [STEP_5] Database bet record found:`, {
                    bet_id: betRecord.bet_id,
                    bet_type: betRecord.bet_type,
                    bet_amount: betRecord.bet_amount,
                    status: betRecord.status
                });
            } else {
                console.log('❌ [STEP_5] No database bet record found');
            }
        } catch (dbError) {
            console.log('❌ [STEP_5] Database check failed:', dbError.message);
        }
        
        console.log('\n🎉 [RESULT_COMPLETE] Result processing trace finished!');
        console.log('========================================');
        
    } catch (error) {
        console.error('❌ [RESULT_ERROR] Result processing trace failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await redisClient.quit();
        console.log('🔌 Redis connection closed');
    }
}

// Run the tracer
traceResultProcessing().catch(console.error); 