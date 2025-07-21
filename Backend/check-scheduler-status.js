let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




// Redis client setup
const redisClient = 

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis client connected'));
redisClient.on('ready', () => console.log('Redis client ready'));

/**
 * Check scheduler status and monitor for specific period
 */
async function checkSchedulerStatus() {
    try {
        console.log('🔍 [SCHEDULER_CHECK] ==========================================');
        console.log('🔍 [SCHEDULER_CHECK] Checking scheduler status');
        console.log('🔍 [SCHEDULER_CHECK] ==========================================');

        // Check if scheduler is running by looking for scheduler keys
        const schedulerKeys = await redisClient.keys('scheduler_*');
        console.log('📊 [SCHEDULER_CHECK] Scheduler keys found:', schedulerKeys.length);
        
        if (schedulerKeys.length > 0) {
            console.log('✅ [SCHEDULER_CHECK] Scheduler appears to be running');
            console.log('📊 [SCHEDULER_CHECK] Sample keys:', schedulerKeys.slice(0, 5));
        } else {
            console.log('❌ [SCHEDULER_CHECK] No scheduler keys found - scheduler may not be running');
        }

        // Check for specific period processing
        const periodId = '20250706000000434'; // Your period
        const gameType = 'wingo';
        const duration = 30;
        
        console.log(`\n🎯 [SCHEDULER_CHECK] Checking for period: ${periodId}`);
        
        // Check for processing locks
        const processingLocks = await redisClient.keys(`*${periodId}*`);
        console.log('🔒 [SCHEDULER_CHECK] Processing locks for this period:', processingLocks);
        
        // Check for existing results
        const resultKeys = await redisClient.keys(`*result*${periodId}*`);
        console.log('🏆 [SCHEDULER_CHECK] Result keys for this period:', resultKeys);
        
        // Check for exposure data (try both patterns)
        const exposureKey1 = `exposure:${gameType}:${duration}:${periodId}`;
        const exposureKey2 = `duewin:exposure:${gameType}:${duration}:${periodId}`;
        let exposureData = await redisClient.hgetall(exposureKey1);
        if (Object.keys(exposureData).length === 0) {
            exposureData = await redisClient.hgetall(exposureKey2);
        }
        console.log('📊 [SCHEDULER_CHECK] Exposure data for this period:', exposureData);
        console.log('📊 [SCHEDULER_CHECK] Exposure keys tried:', [exposureKey1, exposureKey2]);
        
        // Check for bet data (try both patterns)
        const betKey1 = `bets:${gameType}:${duration}:default:${periodId}`;
        const betKey2 = `duewin:bets:${gameType}:${duration}:default:${periodId}`;
        let betData = await redisClient.hgetall(betKey1);
        if (Object.keys(betData).length === 0) {
            betData = await redisClient.hgetall(betKey2);
        }
        console.log('🎲 [SCHEDULER_CHECK] Bet data for this period:', betData);
        console.log('🎲 [SCHEDULER_CHECK] Bet keys tried:', [betKey1, betKey2]);
        
        // Also check for the latest period you bet on
        const latestPeriodId = '20250706000000443'; // Your latest bet
        console.log(`\n🎯 [SCHEDULER_CHECK] Checking for latest period: ${latestPeriodId}`);
        
        const latestExposureKey1 = `exposure:${gameType}:${duration}:${latestPeriodId}`;
        const latestExposureKey2 = `duewin:exposure:${gameType}:${duration}:${latestPeriodId}`;
        let latestExposureData = await redisClient.hgetall(latestExposureKey1);
        if (Object.keys(latestExposureData).length === 0) {
            latestExposureData = await redisClient.hgetall(latestExposureKey2);
        }
        console.log('📊 [SCHEDULER_CHECK] Latest period exposure data:', latestExposureData);
        
        const latestBetKey1 = `bets:${gameType}:${duration}:default:${latestPeriodId}`;
        const latestBetKey2 = `duewin:bets:${gameType}:${duration}:default:${latestPeriodId}`;
        let latestBetData = await redisClient.hgetall(latestBetKey1);
        if (Object.keys(latestBetData).length === 0) {
            latestBetData = await redisClient.hgetall(latestBetKey2);
        }
        console.log('🎲 [SCHEDULER_CHECK] Latest period bet data:', latestBetData);
        
        console.log('\n🔍 [SCHEDULER_CHECK] ==========================================');
        console.log('🔍 [SCHEDULER_CHECK] Scheduler status check completed');
        console.log('🔍 [SCHEDULER_CHECK] ==========================================');

    } catch (error) {
        console.error('❌ [SCHEDULER_CHECK] Error checking scheduler status:', error);
    } finally {
        await redisClient.quit();
    }
}

// Run the check
checkSchedulerStatus(); 
module.exports = { setRedisHelper };
