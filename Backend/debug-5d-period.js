const gameLogicService = require('./services/gameLogicService');
const redisClient = require('./config/redis').getClient();

async function debug5DPeriod() {
    try {
        console.log('🎲 [5D_PERIOD_DEBUG] ==========================================');
        console.log('🎲 [5D_PERIOD_DEBUG] Analyzing 5D period debugging');
        console.log('🎲 [5D_PERIOD_DEBUG] ==========================================');

        // Test period data
        const periodId = '20241201001';
        const gameType = '5d';
        const duration = 30;
        const timeline = 'default';

        console.log('\n📊 [5D_PERIOD_INFO] Period Details:');
        console.log(`   - Period ID: ${periodId}`);
        console.log(`   - Game Type: ${gameType}`);
        console.log(`   - Duration: ${duration}s`);
        console.log(`   - Timeline: ${timeline}`);

        // Step 1: Check Redis exposure data
        console.log('\n💰 [5D_EXPOSURE_CHECK] Checking Redis exposure data...');
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureData = await redisClient.hgetall(exposureKey);

        console.log(`💰 [5D_EXPOSURE_KEY] Key: ${exposureKey}`);
        console.log(`💰 [5D_EXPOSURE_ENTRIES] Total entries: ${Object.keys(exposureData).length}`);

        if (Object.keys(exposureData).length > 0) {
            console.log('💰 [5D_EXPOSURE_DETAILS] Exposure breakdown:');
            let totalExposure = 0;
            
            for (const [betKey, exposure] of Object.entries(exposureData)) {
                const exposureRupees = (parseFloat(exposure) / 100).toFixed(2);
                totalExposure += parseFloat(exposure);
                console.log(`   - ${betKey}: ${exposure} cents (₹${exposureRupees})`);
            }
            
            console.log(`💰 [5D_TOTAL_EXPOSURE] Total exposure: ${totalExposure} cents (₹${(totalExposure / 100).toFixed(2)})`);
        } else {
            console.log('❌ [5D_EXPOSURE] No exposure data found!');
        }

        // Step 2: Check user count
        console.log('\n👥 [5D_USER_COUNT] Checking unique user count...');
        const userCountResult = await gameLogicService.getUniqueUserCount(gameType, duration, periodId, timeline);
        
        console.log('👥 [5D_USER_COUNT_DETAILS]:', {
            uniqueUserCount: userCountResult.uniqueUserCount,
            totalBets: userCountResult.totalBets,
            threshold: userCountResult.threshold,
            meetsThreshold: userCountResult.meetsThreshold,
            uniqueUsers: userCountResult.uniqueUsers,
            betHashKey: userCountResult.betHashKey
        });

        const protectionMode = userCountResult.uniqueUserCount < userCountResult.threshold;
        console.log(`🛡️ [5D_PROTECTION_MODE] Protection active: ${protectionMode ? '✅ YES' : '❌ NO'}`);
        console.log(`🛡️ [5D_PROTECTION_REASON] ${protectionMode ? 'User count < 100' : 'User count >= 100'}`);

        // Step 3: Check bets data
        console.log('\n📝 [5D_BETS_CHECK] Checking bets data...');
        const betsKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await redisClient.hgetall(betsKey);

        console.log(`📝 [5D_BETS_KEY] Key: ${betsKey}`);
        console.log(`📝 [5D_BETS_COUNT] Total bets: ${Object.keys(betsData).length}`);

        if (Object.keys(betsData).length > 0) {
            console.log('📝 [5D_BETS_DETAILS] Bet breakdown:');
            const uniqueUsers = new Set();
            let totalBetAmount = 0;

            for (const [betId, betJson] of Object.entries(betsData)) {
                try {
                    const bet = JSON.parse(betJson);
                    uniqueUsers.add(bet.userId);
                    const betAmount = parseFloat(bet.betAmount || bet.netBetAmount || 0);
                    totalBetAmount += betAmount;
                    
                    console.log(`   - Bet ${betId}: User ${bet.userId}, ${bet.betType}:${bet.betValue}, Amount: ₹${betAmount.toFixed(2)}`);
                } catch (parseError) {
                    console.log(`   - Bet ${betId}: Parse error - ${parseError.message}`);
                }
            }

            console.log(`📝 [5D_BETS_SUMMARY] Unique users: ${uniqueUsers.size}, Total amount: ₹${totalBetAmount.toFixed(2)}`);
        } else {
            console.log('❌ [5D_BETS] No bets data found!');
        }

        // Step 4: Simulate result selection
        console.log('\n🎯 [5D_RESULT_SELECTION] Simulating result selection...');
        
        if (protectionMode) {
            console.log('🛡️ [5D_PROTECTED_SELECTION] Using PROTECTED result selection...');
            
            // Simulate protected result selection
            const protectedResult = await gameLogicService.selectProtectedResultWithExposure(
                gameType, duration, periodId, timeline
            );
            
            if (protectedResult) {
                console.log('🛡️ [5D_PROTECTED_RESULT] Selected protected result:', protectedResult);
                
                // Check why this result was selected
                console.log('🛡️ [5D_PROTECTION_ANALYSIS] Protection analysis:');
                
                // Find unbet positions
                const unbetPositions = findUnbetPositions(exposureData);
                console.log('🛡️ [5D_UNBET_POSITIONS] Unbet positions:', unbetPositions);
                
                // Check if result uses unbet positions
                for (const [pos, values] of Object.entries(unbetPositions)) {
                    if (values.length > 0) {
                        const resultValue = protectedResult[pos];
                        const usesUnbetPosition = values.includes(resultValue);
                        console.log(`   - Position ${pos}: Result ${resultValue}, Unbet values: [${values.join(', ')}], Uses unbet: ${usesUnbetPosition ? '✅ YES' : '❌ NO'}`);
                    }
                }
            } else {
                console.log('❌ [5D_PROTECTED_RESULT] No protected result found!');
            }
        } else {
            console.log('📊 [5D_NORMAL_SELECTION] Using NORMAL 60/40 enforcement...');
            
            // Simulate normal result selection
            const resultWithVerification = await gameLogicService.calculateResultWithVerification(
                gameType, duration, periodId, timeline
            );
            
            if (resultWithVerification && resultWithVerification.result) {
                console.log('📊 [5D_NORMAL_RESULT] Selected normal result:', resultWithVerification.result);
                console.log('📊 [5D_SELECTION_REASON] Selection reason:', resultWithVerification.protectionReason);
                
                // Calculate exposure for selected result
                const selectedResult = resultWithVerification.result;
                const exposure = await gameLogicService.calculate5DExposure(selectedResult, exposureData);
                const totalBetAmount = Object.values(betsData).reduce((sum, betJson) => {
                    try {
                        const bet = JSON.parse(betJson);
                        return sum + parseFloat(bet.betAmount || bet.netBetAmount || 0);
                    } catch {
                        return sum;
                    }
                }, 0);
                
                const payoutPercent = totalBetAmount > 0 ? (exposure / totalBetAmount) * 100 : 0;
                
                console.log('📊 [5D_EXPOSURE_ANALYSIS] Result exposure analysis:');
                console.log(`   - Selected result: ${JSON.stringify(selectedResult)}`);
                console.log(`   - Result exposure: ₹${(exposure / 100).toFixed(2)}`);
                console.log(`   - Total bet amount: ₹${totalBetAmount.toFixed(2)}`);
                console.log(`   - Payout percentage: ${payoutPercent.toFixed(2)}%`);
                console.log(`   - Meets 60% limit: ${payoutPercent <= 60 ? '✅ YES' : '❌ NO'}`);
            } else {
                console.log('❌ [5D_NORMAL_RESULT] No normal result found!');
            }
        }

        // Step 5: Check database result (if exists)
        console.log('\n💾 [5D_DATABASE_CHECK] Checking database result...');
        try {
            const models = await gameLogicService.ensureModelsInitialized();
            
            // Try different possible table names
            let resultRecord = null;
            
            // Try GameResult table
            if (models.GameResult) {
                resultRecord = await models.GameResult.findOne({
                    where: {
                        game_type: gameType,
                        period_id: periodId,
                        timeline: timeline
                    }
                });
            }
            
            // Try GameResults table if GameResult doesn't exist
            if (!resultRecord && models.GameResults) {
                resultRecord = await models.GameResults.findOne({
                    where: {
                        game_type: gameType,
                        period_id: periodId,
                        timeline: timeline
                    }
                });
            }

            if (resultRecord) {
                console.log('💾 [5D_DATABASE_RESULT] Found database result:', {
                    resultId: resultRecord.result_id || resultRecord.id,
                    result: resultRecord.result,
                    created_at: resultRecord.created_at,
                    timeline: resultRecord.timeline
                });
            } else {
                console.log('❌ [5D_DATABASE_RESULT] No database result found');
            }
        } catch (dbError) {
            console.log('❌ [5D_DATABASE_ERROR] Database check error:', dbError.message);
            console.log('💾 [5D_DATABASE_INFO] Available models:', Object.keys(models || {}));
        }

        console.log('\n🎲 [5D_PERIOD_DEBUG] ==========================================');
        console.log('🎲 [5D_PERIOD_DEBUG] 5D period debugging completed');
        console.log('🎲 [5D_PERIOD_DEBUG] ==========================================');

    } catch (error) {
        console.error('❌ [5D_PERIOD_DEBUG] Error in 5D period debugging:', error);
    }
}

// Helper function to find unbet positions (copied from gameLogicService)
function findUnbetPositions(betExposures) {
    const positions = ['A', 'B', 'C', 'D', 'E'];
    const unbetPositions = {};

    for (const pos of positions) {
        const unbetValues = [];
        for (let num = 0; num <= 9; num++) {
            const betKey = `bet:POSITION:${pos}_${num}`;
            const exposure = parseFloat(betExposures[betKey] || 0);
            if (exposure === 0) {
                unbetValues.push(num);
            }
        }
        if (unbetValues.length > 0) {
            unbetPositions[pos] = unbetValues;
        }
    }

    return unbetPositions;
}

// Run the debug function
debug5DPeriod().then(() => {
    console.log('✅ 5D period debugging completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ 5D period debugging failed:', error);
    process.exit(1);
}); 