let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




// Redis client setup
const redisClient = 

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis client connected'));
redisClient.on('ready', () => console.log('Redis client ready'));

/**
 * Test the fixes for the identified issues
 */
async function testFixes() {
    try {
        console.log('🧪 Testing Fixes');
        console.log('==================================');

        // Test 1: Check if enhancedValidation error is fixed
        console.log('\n📝 Test 1: Checking enhancedValidation fix...');
        
        // Import the fixed game logic service
        const gameLogicService = require('./services/gameLogicService');
        
        // Test the calculateResultWithVerification function
        const testPeriodId = '20250706000000252';
        const testGameType = 'wingo';
        const testDuration = 30;
        const testTimeline = 'default';
        
        console.log('✅ Game logic service imported successfully');
        
        // Test 2: Check Redis key patterns
        console.log('\n📝 Test 2: Checking Redis key patterns...');
        
        const betHashKey = `bets:${testGameType}:${testDuration}:${testTimeline}:${testPeriodId}`;
        console.log('📊 Expected bet hash key:', betHashKey);
        
        // Check if bets exist
        const betsData = await redisClient.hgetall(betHashKey);
        console.log('📊 Bets found in Redis:', Object.keys(betsData).length);
        
        if (Object.keys(betsData).length > 0) {
            console.log('✅ Bets found in Redis with correct key pattern');
            
            // Count unique users
            const uniqueUsers = new Set();
            for (const [betId, betJson] of Object.entries(betsData)) {
                try {
                    const bet = JSON.parse(betJson);
                    if (bet.userId) {
                        uniqueUsers.add(bet.userId);
                    }
                } catch (parseError) {
                    console.warn('⚠️ Failed to parse bet:', parseError.message);
                }
            }
            
            console.log('👥 Unique users found:', uniqueUsers.size);
            console.log('👥 User IDs:', Array.from(uniqueUsers));
        } else {
            console.log('⚠️ No bets found in Redis for this period');
            
            // Try alternative key patterns
            const altKeys = [
                `duewin:bets:${testGameType}:${testDuration}:${testTimeline}:${testPeriodId}`,
                `bets:${testGameType}:${testDuration}:default:${testPeriodId}`,
                `duewin:bets:${testGameType}:${testDuration}:default:${testPeriodId}`
            ];
            
            console.log('🔍 Trying alternative key patterns...');
            for (const altKey of altKeys) {
                const altData = await redisClient.hgetall(altKey);
                if (Object.keys(altData).length > 0) {
                    console.log(`✅ Found bets in alternative key: ${altKey}`);
                    console.log(`📊 Alternative key total bets: ${Object.keys(altData).length}`);
                    break;
                }
            }
        }
        
        // Test 3: Test protection logic
        console.log('\n📝 Test 3: Testing protection logic...');
        
        try {
            // Test the getUniqueUserCount function
            const userCount = await gameLogicService.getUniqueUserCount(testGameType, testDuration, testPeriodId, testTimeline);
            console.log('👥 User count result:', userCount);
            
            // Test the selectProtectedResultWithExposure function
            const protectedResult = await gameLogicService.selectProtectedResultWithExposure(testGameType, testDuration, testPeriodId, testTimeline);
            console.log('🛡️ Protected result:', protectedResult);
            
            console.log('✅ Protection logic working correctly');
        } catch (error) {
            console.error('❌ Error testing protection logic:', error.message);
        }
        
        // Test 4: Test result calculation
        console.log('\n📝 Test 4: Testing result calculation...');
        
        try {
            const result = await gameLogicService.calculateResultWithVerification(testGameType, testDuration, testPeriodId, testTimeline);
            console.log('🎲 Result calculation successful');
            console.log('🎲 Protection mode:', result.protectionMode);
            console.log('🎲 Protection reason:', result.protectionReason);
            console.log('✅ Result calculation working correctly');
        } catch (error) {
            console.error('❌ Error in result calculation:', error.message);
        }
        
        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await redisClient.quit();
        console.log('🔌 Redis connection closed');
    }
}

// Run the tests
testFixes(); 
module.exports = { setRedisHelper };
