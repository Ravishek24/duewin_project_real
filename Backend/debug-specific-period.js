const { 
    ensureModelsInitialized, 
    getUniqueUserCount, 
    getBetsFromHash,
    updateBetExposure,
    selectProtectedResultWithExposure,
    calculateResultWithVerification,
    ENHANCED_USER_THRESHOLD
} = require('./services/gameLogicService');
const redisClient = require('./config/redis');

async function debugSpecificPeriod() {
    try {
        console.log('🔍 [PERIOD_DEBUG] ==========================================');
        console.log('🔍 [PERIOD_DEBUG] Analyzing period 20250706000001881');
        console.log('🔍 [PERIOD_DEBUG] ==========================================');

        await ensureModelsInitialized();
        const models = require('./services/gameLogicService').models;

        const periodId = '20250706000001881';
        const gameType = 'wingo';
        const duration = 30;
        const timeline = 'default';

        // Step 1: Check database bet records
        console.log('\n📝 [STEP 1] Checking database bet records...');
        const betRecords = await models.BetRecordWingo.findAll({
            where: { bet_number: periodId },
            order: [['created_at', 'ASC']]
        });

        console.log(`📝 [BET_RECORDS] Found ${betRecords.length} bet records:`);
        const uniqueUserIds = new Set();
        
        betRecords.forEach((bet, index) => {
            uniqueUserIds.add(bet.user_id);
            console.log(`  ${index + 1}. User ${bet.user_id}: ${bet.bet_type}, Amount: ${bet.bet_amount}₹, Status: ${bet.status}, Win: ${bet.win_amount || 0}₹`);
        });

        console.log(`📝 [BET_SUMMARY] Unique users: ${uniqueUserIds.size}, Threshold: ${ENHANCED_USER_THRESHOLD}`);
        console.log(`📝 [BET_SUMMARY] Protection should be: ${uniqueUserIds.size < ENHANCED_USER_THRESHOLD ? '✅ ACTIVE' : '❌ INACTIVE'}`);

        // Step 2: Check result record
        console.log('\n🎲 [STEP 2] Checking result record...');
        const resultRecord = await models.BetResultWingo.findOne({
            where: { bet_number: periodId }
        });

        if (resultRecord) {
            console.log('🎲 [RESULT_RECORD] Found result:', {
                number: resultRecord.result_of_number,
                color: resultRecord.result_of_color,
                size: resultRecord.result_of_size,
                timeline: resultRecord.timeline
            });
        } else {
            console.log('🎲 [RESULT_RECORD] No result found in database');
        }

        // Step 3: Check Redis bet data  
        console.log('\n💾 [STEP 3] Checking Redis bet data...');
        const betKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        let redisBets = {};
        try {
            // Try different Redis client methods
            if (typeof redisClient.hgetall === 'function') {
                redisBets = await redisClient.hgetall(betKey);
            } else if (typeof redisClient.hGetAll === 'function') {
                redisBets = await redisClient.hGetAll(betKey);
            } else {
                console.log('💾 [REDIS_BETS] Redis hgetall method not available, skipping Redis check');
                redisBets = {};
            }
        } catch (redisError) {
            console.log('💾 [REDIS_BETS] Redis error:', redisError.message);
            redisBets = {};
        }
        
        console.log(`💾 [REDIS_BETS] Redis bet key: ${betKey}`);
        console.log(`💾 [REDIS_BETS] Found ${Object.keys(redisBets).length} bets in Redis:`);

        const redisUniqueUsers = new Set();
        Object.entries(redisBets).forEach(([betId, betJson]) => {
            try {
                const bet = JSON.parse(betJson);
                redisUniqueUsers.add(bet.userId);
                console.log(`  ${betId}: User ${bet.userId}, ${bet.betType} ${bet.betValue}, ${bet.netBetAmount || bet.betAmount}₹`);
            } catch (e) {
                console.log(`  ${betId}: Parse error - ${e.message}`);
            }
        });

        console.log(`💾 [REDIS_SUMMARY] Redis unique users: ${redisUniqueUsers.size}`);

        // Step 4: Check exposure data
        console.log('\n💰 [STEP 4] Checking exposure data...');
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        let exposureData = {};
        try {
            if (typeof redisClient.hgetall === 'function') {
                exposureData = await redisClient.hgetall(exposureKey);
            } else if (typeof redisClient.hGetAll === 'function') {
                exposureData = await redisClient.hGetAll(exposureKey);
            } else {
                console.log('💰 [EXPOSURE_DATA] Redis hgetall method not available, skipping exposure check');
                exposureData = {};
            }
        } catch (redisError) {
            console.log('💰 [EXPOSURE_DATA] Redis error:', redisError.message);
            exposureData = {};
        }
        
        console.log(`💰 [EXPOSURE_KEY] Key: ${exposureKey}`);
        console.log(`💰 [EXPOSURE_DATA] Found ${Object.keys(exposureData).length} exposure entries:`);

        const exposureAnalysis = {};
        for (let num = 0; num <= 9; num++) {
            const exposure = parseInt(exposureData[`number:${num}`] || 0);
            exposureAnalysis[num] = exposure;
            console.log(`  Number ${num}: ${exposure} cents (${(exposure / 100).toFixed(2)}₹)`);
        }

        // Step 5: Analyze what protection should have done
        console.log('\n🛡️ [STEP 5] Protection analysis...');
        const zeroExposureNumbers = [];
        const nonZeroExposureNumbers = [];

        for (let num = 0; num <= 9; num++) {
            const exposure = exposureAnalysis[num];
            if (exposure === 0) {
                zeroExposureNumbers.push(num);
            } else {
                nonZeroExposureNumbers.push(num);
            }
        }

        console.log(`🛡️ [PROTECTION] Zero exposure numbers: [${zeroExposureNumbers.join(', ')}]`);
        console.log(`🛡️ [PROTECTION] Non-zero exposure numbers: [${nonZeroExposureNumbers.join(', ')}]`);

        if (uniqueUserIds.size < ENHANCED_USER_THRESHOLD) {
            if (zeroExposureNumbers.length > 0) {
                console.log('🛡️ [PROTECTION] Protection SHOULD select from zero-exposure numbers');
                console.log(`🛡️ [PROTECTION] Expected result: One of [${zeroExposureNumbers.join(', ')}]`);
                console.log(`🛡️ [PROTECTION] Actual result: ${resultRecord ? resultRecord.result_of_number : 'Unknown'}`);
                
                if (resultRecord && !zeroExposureNumbers.includes(resultRecord.result_of_number)) {
                    console.log('❌ [PROTECTION] PROTECTION FAILED - Result was NOT from zero-exposure numbers!');
                } else {
                    console.log('✅ [PROTECTION] Protection worked correctly');
                }
            } else {
                console.log('⚠️ [PROTECTION] No zero-exposure numbers available - user bet on everything');
            }
        } else {
            console.log('ℹ️ [PROTECTION] Protection not needed - multiple users');
        }

        // Step 6: Test current protection logic
        console.log('\n🧪 [STEP 6] Testing current protection logic...');
        try {
            const userCount = await getUniqueUserCount(gameType, duration, periodId, timeline);
            console.log(`🧪 [TEST_PROTECTION] getUniqueUserCount result: ${userCount}`);
            
            if (userCount < ENHANCED_USER_THRESHOLD) {
                console.log('🧪 [TEST_PROTECTION] Calling selectProtectedResultWithExposure...');
                const protectedResult = await selectProtectedResultWithExposure(gameType, duration, periodId, timeline);
                console.log('🧪 [TEST_PROTECTION] Protected result would be:', protectedResult);
            }

            console.log('🧪 [TEST_PROTECTION] Calling calculateResultWithVerification...');
            const calculatedResult = await calculateResultWithVerification(gameType, duration, periodId, timeline);
            console.log('🧪 [TEST_PROTECTION] Calculated result:', calculatedResult);
            
        } catch (error) {
            console.error('❌ [TEST_PROTECTION] Error testing protection logic:', error.message);
        }

        // Step 7: Check for any cleanup or interference
        console.log('\n🔍 [STEP 7] Checking for data interference...');
        
        // Check if any other timeline keys exist
        try {
            let allKeys = [];
            if (typeof redisClient.keys === 'function') {
                allKeys = await redisClient.keys(`*${periodId}*`);
            }
            console.log(`🔍 [INTERFERENCE] All keys containing period ID (${allKeys.length} found):`);
            allKeys.forEach(key => console.log(`  ${key}`));

            // Check if the exposure key still exists
            let exposureExists = false;
            if (typeof redisClient.exists === 'function') {
                exposureExists = await redisClient.exists(exposureKey);
            }
            console.log(`🔍 [INTERFERENCE] Exposure key exists: ${exposureExists ? 'YES' : 'NO'}`);

            if (!exposureExists && Object.keys(exposureData).length === 0) {
                console.log('❌ [INTERFERENCE] Exposure data was deleted or never created!');
            }
        } catch (redisError) {
            console.log('🔍 [INTERFERENCE] Redis error during interference check:', redisError.message);
        }

        // Step 8: CRITICAL ANALYSIS - Win/Loss Contradiction
        console.log('\n🚨 [STEP 8] CRITICAL ANALYSIS - Win/Loss Logic...');
        
        if (betRecords.length > 0 && resultRecord) {
            const bet = betRecords[0]; // First bet
            console.log('🚨 [CRITICAL] Analyzing bet vs result:');
            console.log(`  Bet: ${bet.bet_type} (Amount: ${bet.bet_amount}₹)`);
            console.log(`  Result: Number ${resultRecord.result_of_number} (${resultRecord.result_of_color})`);
            console.log(`  Status: ${bet.status}, Win Amount: ${bet.win_amount || 0}₹`);
            
            // Check if this makes sense
            if (bet.bet_type === 'COLOR:red' && resultRecord.result_of_color === 'green') {
                if (bet.status === 'won') {
                    console.log('❌ [CRITICAL] IMPOSSIBLE! User bet RED, result was GREEN, but user WON!');
                    console.log('❌ [CRITICAL] This indicates a serious bug in win/loss calculation logic!');
                } else {
                    console.log('✅ [CRITICAL] Correct: User bet RED, result was GREEN, user lost');
                }
            } else if (bet.bet_type === 'COLOR:red' && resultRecord.result_of_color === 'red') {
                if (bet.status === 'won') {
                    console.log('✅ [CRITICAL] Correct: User bet RED, result was RED, user won');
                } else {
                    console.log('❌ [CRITICAL] WRONG! User bet RED, result was RED, but user lost!');
                }
            }
            
            // Check if protection actually worked by looking at the result
            if (uniqueUserIds.size < ENHANCED_USER_THRESHOLD) {
                console.log('🛡️ [CRITICAL] Protection should have been active');
                if (bet.bet_type === 'COLOR:red') {
                    const expectedLosing = [1, 3, 5, 7, 9]; // Green numbers
                    if (expectedLosing.includes(resultRecord.result_of_number)) {
                        console.log('✅ [CRITICAL] Protection result selection worked - selected losing number');
                        if (bet.status === 'won') {
                            console.log('❌ [CRITICAL] But win/loss calculation is WRONG!');
                        }
                    } else {
                        console.log('❌ [CRITICAL] Protection result selection failed - should have selected green number');
                    }
                }
            }
        }

        console.log('\n🔍 [PERIOD_DEBUG] ==========================================');
        console.log('🔍 [PERIOD_DEBUG] Analysis complete');
        console.log('🔍 [PERIOD_DEBUG] ==========================================');

    } catch (error) {
        console.error('❌ [PERIOD_DEBUG] Error during analysis:', error.message);
        console.error('❌ [PERIOD_DEBUG] Stack:', error.stack);
    } finally {
        process.exit(0);
    }
}

debugSpecificPeriod(); 