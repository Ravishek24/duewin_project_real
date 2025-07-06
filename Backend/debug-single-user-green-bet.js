// Initialize Redis and database connections
const redis = require('redis');
const { processBet, calculateResultWithVerification, getUniqueUserCount } = require('./services/gameLogicService');

let redisClient;

async function initializeConnections() {
    try {
        // Initialize Redis
        redisClient = redis.createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined
        });
        
        await redisClient.connect();
        console.log('✅ [DEBUG] Redis connected');
        
        // Initialize database models
        const { ensureModelsInitialized } = require('./services/gameLogicService');
        await ensureModelsInitialized();
        console.log('✅ [DEBUG] Database models initialized');
        
    } catch (error) {
        console.error('❌ [DEBUG] Connection initialization failed:', error);
        throw error;
    }
}

async function debugSingleUserGreenBet() {
    try {
        console.log('🐛 [DEBUG] Starting single user green bet trace...');
        
        // Initialize connections first
        await initializeConnections();
        
        const gameType = 'wingo';
        const duration = 30;
        const timeline = 'default';
        const periodId = '2024122500000001'; // Example period ID
        const userId = 'test_user_123';
        
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
        console.log('✅ [DEBUG] Bet processing result:', betResult);
        
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
        
        // 5. ANALYZE ZERO EXPOSURE NUMBERS
        console.log('\n5️⃣ [DEBUG] Analyzing zero exposure numbers...');
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
        
        // 6. CHECK USER COUNT
        console.log('\n6️⃣ [DEBUG] Checking user count...');
        const uniqueUserCount = await getUniqueUserCount(gameType, duration, periodId, timeline);
        const ENHANCED_USER_THRESHOLD = 100;
        const shouldUseProtectedResult = uniqueUserCount < ENHANCED_USER_THRESHOLD;
        
        console.log('👥 [DEBUG] User count analysis:', {
            uniqueUserCount,
            threshold: ENHANCED_USER_THRESHOLD,
            shouldUseProtectedResult
        });
        
        // 7. SIMULATE RESULT CALCULATION
        console.log('\n7️⃣ [DEBUG] Simulating result calculation...');
        const resultCalculation = await calculateResultWithVerification(gameType, duration, periodId, timeline);
        console.log('🎲 [DEBUG] Result calculation:', resultCalculation);
        
        // 8. ANALYZE IF USER WINS OR LOSES
        console.log('\n8️⃣ [DEBUG] Analyzing if user wins or loses...');
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
        
        // 9. BUG DETECTION
        if (resultCalculation.protectionMode && userWins) {
            console.log('\n❌ [BUG DETECTED] User is winning in protection mode!');
            console.log('🔍 [BUG] This should not happen with single user bet');
            console.log('🔍 [BUG] Zero exposure numbers were:', zeroExposureNumbers);
            console.log('🔍 [BUG] But result was:', resultNumber);
            
            if (zeroExposureNumbers.length === 0) {
                console.log('💡 [BUG ROOT CAUSE] No zero exposure numbers found - exposure tracking issue');
            } else if (!zeroExposureNumbers.includes(resultNumber)) {
                console.log('💡 [BUG ROOT CAUSE] Zero exposure numbers exist but not selected - selection logic issue');
            }
        } else {
            console.log('\n✅ [SUCCESS] Protection logic working correctly - user loses');
        }
        
        console.log('\n🐛 [DEBUG] Single user green bet trace completed');
        
    } catch (error) {
        console.error('❌ [DEBUG ERROR]:', error);
    } finally {
        // Clean up connections
        if (redisClient) {
            await redisClient.quit();
            console.log('✅ [DEBUG] Redis disconnected');
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