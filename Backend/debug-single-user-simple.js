const redisHelper = require('./config/redis');
const redisClient = redisHelper.getClient();
const { processBet, calculateResultWithVerification, getUniqueUserCount, ensureModelsInitialized } = require('./services/gameLogicService');
const { Op } = require('sequelize');

async function debugSingleUserGreenBet() {
    let testUser = null;
    try {
        console.log('🐛 [DEBUG] Starting single user green bet trace...');
        
        // Initialize database models
        const models = await ensureModelsInitialized();
        console.log('✅ [DEBUG] Database models initialized');
        
        const gameType = 'wingo';
        const duration = 30;
        const timeline = 'default';
        const periodId = '2024122500000001'; // Example period ID
        
        // Find an existing user or create a test user
        testUser = await models.User.findOne({
            where: { wallet_balance: { [Op.gte]: 100 } },
            limit: 1
        });
        
        if (!testUser) {
            console.log('📝 [DEBUG] Creating test user...');
            testUser = await models.User.create({
                user_id: 'test_user_debug_' + Date.now(),
                username: 'debug_user',
                email: 'debug@test.com',
                phone: '1234567890',
                password: 'test123',
                wallet_balance: 10000, // ₹10,000 for testing
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            });
            console.log('✅ [DEBUG] Test user created:', testUser.user_id);
        } else {
            console.log('✅ [DEBUG] Using existing user:', testUser.user_id);
        }
        
        const userId = testUser.user_id;
        
        console.log('📊 [DEBUG] Test parameters:', {
            gameType, duration, timeline, periodId, userId
        });
        
        // 1. CLEAR ANY EXISTING DATA
        console.log('\n1️⃣ [DEBUG] Clearing existing data...');
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        
        await redisClient.del(exposureKey);
        await redisClient.del(betHashKey);
        console.log('✅ [DEBUG] Cleared Redis keys:', { exposureKey, betHashKey });
        
        // 2. SIMULATE SINGLE USER BET ON GREEN
        console.log('\n2️⃣ [DEBUG] Simulating bet on GREEN color...');
        const betData = {
            userId: userId,
            gameType: gameType,
            duration: duration,
            timeline: timeline,
            periodId: periodId,
            betType: 'COLOR',
            betValue: 'green',
            betAmount: 100, // ₹100 bet
            odds: 2.0
        };
        
        console.log('🎯 [DEBUG] Bet data:', betData);
        
        // 3. PROCESS THE BET
        console.log('\n3️⃣ [DEBUG] Processing bet...');
        const betResult = await processBet(betData);
        console.log('✅ [DEBUG] Bet processing result:', JSON.stringify(betResult, null, 2));
        
        if (!betResult.success) {
            console.log('❌ [DEBUG] Bet processing failed, stopping trace');
            return;
        }
        
        // 4. CHECK EXPOSURE AFTER BET
        console.log('\n4️⃣ [DEBUG] Checking exposure after bet...');
        const allExposures = await redisClient.hgetall(exposureKey);
        console.log('📊 [DEBUG] Raw exposures from Redis:', allExposures);
        
        // Convert to readable format
        const readableExposures = {};
        for (const [key, value] of Object.entries(allExposures)) {
            readableExposures[key] = `${(parseInt(value) / 100).toFixed(2)}₹`;
        }
        console.log('📊 [DEBUG] Readable exposures:', readableExposures);
        
        // 5. CHECK BET STORAGE
        console.log('\n5️⃣ [DEBUG] Checking bet storage...');
        const allBets = await redisClient.hgetall(betHashKey);
        console.log('🎯 [DEBUG] Stored bets count:', Object.keys(allBets).length);
        
        for (const [betId, betJson] of Object.entries(allBets)) {
            const bet = JSON.parse(betJson);
            console.log(`🎯 [DEBUG] Bet ${betId}:`, {
                userId: bet.userId,
                betType: bet.betType,
                betValue: bet.betValue,
                netBetAmount: bet.netBetAmount
            });
        }
        
        // 6. ANALYZE ZERO EXPOSURE NUMBERS
        console.log('\n6️⃣ [DEBUG] Analyzing zero exposure numbers...');
        const zeroExposureNumbers = [];
        const nonZeroExposureNumbers = [];
        
        for (let num = 0; num <= 9; num++) {
            const exposure = parseInt(allExposures[`number:${num}`] || 0);
            if (exposure === 0) {
                zeroExposureNumbers.push(num);
            } else {
                nonZeroExposureNumbers.push({ number: num, exposure: exposure / 100 });
            }
        }
        
        console.log('🔍 [DEBUG] Zero exposure numbers (should be RED numbers [0,2,4,6,8]):', zeroExposureNumbers);
        console.log('🔍 [DEBUG] Non-zero exposure numbers (should be GREEN numbers [1,3,5,7,9]):', nonZeroExposureNumbers);
        
        // 7. CHECK USER COUNT
        console.log('\n7️⃣ [DEBUG] Checking user count...');
        const uniqueUserCount = await getUniqueUserCount(gameType, duration, periodId, timeline);
        const ENHANCED_USER_THRESHOLD = 100;
        const shouldUseProtectedResult = uniqueUserCount < ENHANCED_USER_THRESHOLD;
        
        console.log('👥 [DEBUG] User count analysis:', {
            uniqueUserCount,
            threshold: ENHANCED_USER_THRESHOLD,
            shouldUseProtectedResult
        });
        
        // 8. SIMULATE RESULT CALCULATION
        console.log('\n8️⃣ [DEBUG] Simulating result calculation...');
        const resultCalculation = await calculateResultWithVerification(gameType, duration, periodId, timeline);
        console.log('🎲 [DEBUG] Result calculation:', JSON.stringify(resultCalculation, null, 2));
        
        // 9. ANALYZE IF USER WINS OR LOSES
        console.log('\n9️⃣ [DEBUG] Analyzing if user wins or loses...');
        const resultNumber = resultCalculation.result.number;
        const isGreenNumber = [1, 3, 5, 7, 9].includes(resultNumber);
        const userWins = isGreenNumber; // User bet on green
        
        console.log('🎯 [DEBUG] Final analysis:', {
            resultNumber,
            isGreenNumber,
            userBetOn: 'GREEN',
            userWins,
            protectionMode: resultCalculation.protectionMode,
            expectedUserWins: false // Should be false in protection mode
        });
        
        // 10. BUG DETECTION
        console.log('\n🔟 [DEBUG] BUG DETECTION...');
        if (resultCalculation.protectionMode && userWins) {
            console.log('\n❌ [BUG DETECTED] User is winning in protection mode!');
            console.log('🔍 [BUG] This should not happen with single user bet');
            console.log('🔍 [BUG] Zero exposure numbers were:', zeroExposureNumbers);
            console.log('🔍 [BUG] But result was:', resultNumber);
            
            if (zeroExposureNumbers.length === 0) {
                console.log('💡 [BUG ROOT CAUSE] No zero exposure numbers found - exposure tracking issue');
                console.log('💡 [BUG FIX NEEDED] Check updateBetExposure function - it should only update GREEN numbers [1,3,5,7,9]');
            } else if (!zeroExposureNumbers.includes(resultNumber)) {
                console.log('💡 [BUG ROOT CAUSE] Zero exposure numbers exist but not selected - selection logic issue');
                console.log('💡 [BUG FIX NEEDED] Check selectProtectedResultWithExposure function');
            }
        } else if (resultCalculation.protectionMode && !userWins) {
            console.log('\n✅ [SUCCESS] Protection logic working correctly - user loses');
            console.log('✅ [SUCCESS] Single user bet on GREEN, result was RED/VIOLET number:', resultNumber);
        } else if (!resultCalculation.protectionMode) {
            console.log('\n⚠️ [WARNING] Protection mode was not triggered');
            console.log('⚠️ [WARNING] This might be due to user count threshold not being met');
        }
        
        console.log('\n🐛 [DEBUG] Single user green bet trace completed');
        
        // Cleanup: Remove test user if we created one
        if (testUser && String(testUser.user_id).startsWith('test_user_debug_')) {
            console.log('\n🧹 [DEBUG] Cleaning up test user...');
            await testUser.destroy();
            console.log('✅ [DEBUG] Test user removed');
        }
        
    } catch (error) {
        console.error('❌ [DEBUG ERROR]:', error);
        console.error('❌ [DEBUG ERROR STACK]:', error.stack);
        
        // Cleanup: Remove test user if we created one (even on error)
        if (testUser && testUser.user_id && String(testUser.user_id).startsWith('test_user_debug_')) {
            try {
                await testUser.destroy();
                console.log('✅ [DEBUG] Test user removed (cleanup after error)');
            } catch (cleanupError) {
                console.error('❌ [DEBUG] Error during cleanup:', cleanupError.message);
            }
        }
    }
}

// Run the debug
debugSingleUserGreenBet().then(() => {
    console.log('🎯 Debug completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ [DEBUG FATAL ERROR]:', error);
    process.exit(1);
}); 