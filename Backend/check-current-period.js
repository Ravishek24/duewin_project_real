const { redis } = require('./config/redisConfig');
const moment = require('moment-timezone');

const USER_ID = '13'; // <-- Set your userId here
const ENHANCED_USER_THRESHOLD = 100; // Should match your backend

// Helper: Simulate getUniqueUserCount
async function simulateGetUniqueUserCount(gameType, duration, periodId, timeline = 'default') {
    const betHashKey = `duewin:bets:${gameType}:${duration}:${timeline}:${periodId}`;
    const betsData = await redis.hGetAll(betHashKey);
    const uniqueUsers = new Set();
    for (const [betId, betJson] of Object.entries(betsData)) {
        try {
            const bet = JSON.parse(betJson);
            if (bet.userId) uniqueUsers.add(bet.userId);
        } catch {}
    }
    return { count: uniqueUsers.size, uniqueUsers: Array.from(uniqueUsers), totalBets: Object.keys(betsData).length };
}

// Helper: Simulate selectProtectedResultWithExposure for wingo
async function simulateSelectProtectedResultWithExposure(gameType, duration, periodId, timeline = 'default') {
    const exposureKey = `duewin:exposure:${gameType}:${duration}:${periodId}`;
    const wingoExposures = await redis.hGetAll(exposureKey);
    // Find zero exposure numbers
    const zeroExposureNumbers = [];
    for (let num = 0; num <= 9; num++) {
        const exposure = parseInt(wingoExposures[`number:${num}`] || 0);
        if (exposure === 0) zeroExposureNumbers.push(num);
    }
    // Get all user bets
    const betHashKey = `duewin:bets:${gameType}:${duration}:default:${periodId}`;
    const betsData = await redis.hGetAll(betHashKey);
    const userBetOutcomes = new Set();
    for (const [betId, betJson] of Object.entries(betsData)) {
        try {
            const bet = JSON.parse(betJson);
            if (bet.betType === 'COLOR' && bet.betValue === 'red') {
                userBetOutcomes.add(0); userBetOutcomes.add(2); userBetOutcomes.add(4); userBetOutcomes.add(6); userBetOutcomes.add(8);
            } else if (bet.betType === 'COLOR' && bet.betValue === 'green') {
                userBetOutcomes.add(1); userBetOutcomes.add(3); userBetOutcomes.add(5); userBetOutcomes.add(7); userBetOutcomes.add(9);
            } else if (bet.betType === 'NUMBER') {
                userBetOutcomes.add(parseInt(bet.betValue));
            }
        } catch {}
    }
    // If there are zero-exposure numbers, pick one
    if (zeroExposureNumbers.length > 0) {
        return { mode: 'zero-exposure', selected: zeroExposureNumbers[0], zeroExposureNumbers };
    }
    // Otherwise, pick a number the user did NOT bet on
    const losingNumbers = [];
    for (let num = 0; num <= 9; num++) {
        if (!userBetOutcomes.has(num)) losingNumbers.push(num);
    }
    if (losingNumbers.length > 0) {
        return { mode: 'force-lose', selected: losingNumbers[0], losingNumbers };
    }
    // Otherwise, pick the lowest exposure
    let minExposure = Infinity, lowestExposureNumber = 0;
    for (let num = 0; num <= 9; num++) {
        const exposure = parseInt(wingoExposures[`number:${num}`] || 0);
        if (exposure < minExposure) {
            minExposure = exposure;
            lowestExposureNumber = num;
        }
    }
    return { mode: 'lowest-exposure', selected: lowestExposureNumber };
}

// Helper: Simulate if bet would win for a result
function simulateBetWin(bet, resultNumber) {
    if (bet.betType === 'COLOR' && bet.betValue === 'red') {
        return [0,2,4,6,8].includes(resultNumber);
    }
    if (bet.betType === 'COLOR' && bet.betValue === 'green') {
        return [1,3,5,7,9].includes(resultNumber);
    }
    if (bet.betType === 'COLOR' && bet.betValue === 'violet') {
        return [0,5].includes(resultNumber);
    }
    if (bet.betType === 'NUMBER') {
        return parseInt(bet.betValue) === resultNumber;
    }
    return false;
}

/**
 * Check what the current period should be according to scheduler calculation
 * and show the user's bet details for the current and last 5 periods
 */
async function checkCurrentPeriodAndUserBet() {
    try {
        console.log('🔍 [CURRENT_PERIOD_CHECK] ==========================================');
        console.log('🔍 [CURRENT_PERIOD_CHECK] Checking current period calculation and user bet');
        console.log('🔍 [CURRENT_PERIOD_CHECK] ==========================================');

        const gameType = 'wingo';
        const duration = 30;
        const now = new Date();
        const istMoment = moment(now).tz('Asia/Kolkata');
        
        console.log(`⏰ Current time (IST): ${istMoment.format()}`);
        
        // Calculate time since 2 AM today
        let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
        
        // If current time is before 2 AM, use 2 AM of previous day
        if (istMoment.hour() < 2) {
            startOfPeriods.subtract(1, 'day');
        }
        
        console.log(`🌅 Start of periods (2 AM): ${startOfPeriods.format()}`);
        
        // Calculate total seconds since period start
        const totalSeconds = istMoment.diff(startOfPeriods, 'seconds');
        console.log(`⏱️ Total seconds since 2 AM: ${totalSeconds}`);
        
        // Calculate current period number (0-based)
        const currentPeriodNumber = Math.floor(totalSeconds / duration);
        console.log(`📊 Current period number: ${currentPeriodNumber}`);
        
        // Generate period ID
        const dateStr = startOfPeriods.format('YYYYMMDD');
        const currentPeriodId = `${dateStr}${currentPeriodNumber.toString().padStart(9, '0')}`;
        console.log(`🎯 Current period ID: ${currentPeriodId}`);
        
        // Calculate when current period started and ends
        const currentPeriodStart = startOfPeriods.clone().add(currentPeriodNumber * duration, 'seconds');
        const currentPeriodEnd = currentPeriodStart.clone().add(duration, 'seconds');
        const timeRemaining = Math.max(0, currentPeriodEnd.diff(istMoment, 'seconds'));
        
        console.log(`🕐 Current period start: ${currentPeriodStart.format()}`);
        console.log(`🕐 Current period end: ${currentPeriodEnd.format()}`);
        console.log(`⏳ Time remaining: ${timeRemaining}s`);
        
        // Check if we need to move to the next period
        if (timeRemaining <= 0) {
            console.log(`⚠️ Period ${currentPeriodId} has expired, getting next period`);
            const nextPeriodNumber = currentPeriodNumber + 1;
            const nextPeriodId = `${dateStr}${nextPeriodNumber.toString().padStart(9, '0')}`;
            
            console.log(`🔄 Next period ID: ${nextPeriodId}`);
            
            // Calculate next period times
            const nextPeriodStart = startOfPeriods.clone().add(nextPeriodNumber * duration, 'seconds');
            const nextPeriodEnd = nextPeriodStart.clone().add(duration, 'seconds');
            const nextTimeRemaining = Math.max(0, nextPeriodEnd.diff(istMoment, 'seconds'));
            
            console.log(`🕐 Next period start: ${nextPeriodStart.format()}`);
            console.log(`🕐 Next period end: ${nextPeriodEnd.format()}`);
            console.log(`⏳ Next period time remaining: ${nextTimeRemaining}s`);
            
            // Check Redis for both periods
            console.log(`\n🔍 [REDIS_CHECK] Checking Redis for both periods...`);
            
            // Check current period
            const currentExposureKey = `duewin:exposure:${gameType}:${duration}:${currentPeriodId}`;
            const currentBetKey = `duewin:bets:${gameType}:${duration}:default:${currentPeriodId}`;
            
            const currentExposureData = await redis.hGetAll(currentExposureKey);
            const currentBetData = await redis.hGetAll(currentBetKey);
            
            console.log(`📊 Current period (${currentPeriodId}) exposure data:`, currentExposureData);
            console.log(`🎲 Current period (${currentPeriodId}) bet data:`, currentBetData);
            
            // Check next period
            const nextExposureKey = `duewin:exposure:${gameType}:${duration}:${nextPeriodId}`;
            const nextBetKey = `duewin:bets:${gameType}:${duration}:default:${nextPeriodId}`;
            
            const nextExposureData = await redis.hGetAll(nextExposureKey);
            const nextBetData = await redis.hGetAll(nextBetKey);
            
            console.log(`📊 Next period (${nextPeriodId}) exposure data:`, nextExposureData);
            console.log(`🎲 Next period (${nextPeriodId}) bet data:`, nextBetData);
            
            // Determine which period should be processed
            if (Object.keys(nextExposureData).length > 0 || Object.keys(nextBetData).length > 0) {
                console.log(`✅ NEXT period (${nextPeriodId}) has data - this should be processed`);
            } else if (Object.keys(currentExposureData).length > 0 || Object.keys(currentBetData).length > 0) {
                console.log(`✅ CURRENT period (${currentPeriodId}) has data - this should be processed`);
            } else {
                console.log(`❌ Neither period has data`);
            }
            
        } else {
            console.log(`✅ Current period (${currentPeriodId}) is still active`);
            
            // Check Redis for current period
            console.log(`\n🔍 [REDIS_CHECK] Checking Redis for current period...`);
            
            const currentExposureKey = `duewin:exposure:${gameType}:${duration}:${currentPeriodId}`;
            const currentBetKey = `duewin:bets:${gameType}:${duration}:default:${currentPeriodId}`;
            
            const currentExposureData = await redis.hGetAll(currentExposureKey);
            const currentBetData = await redis.hGetAll(currentBetKey);
            
            console.log(`📊 Current period (${currentPeriodId}) exposure data:`, currentExposureData);
            console.log(`🎲 Current period (${currentPeriodId}) bet data:`, currentBetData);
        }
        
        // Show bet details for current and last 5 periods
        for (let i = 0; i <= 5; i++) {
            const periodNumber = currentPeriodNumber - i;
            if (periodNumber < 0) continue;
            const periodId = `${dateStr}${periodNumber.toString().padStart(9, '0')}`;
            const betKey = `duewin:bets:${gameType}:${duration}:default:${periodId}`;
            const betData = await redis.hGetAll(betKey);
            // Filter for this user
            const userBets = Object.entries(betData)
                .map(([betId, betJson]) => {
                    try { return JSON.parse(betJson); } catch { return null; }
                })
                .filter(bet => bet && String(bet.userId) === USER_ID);
            if (userBets.length > 0) {
                console.log(`\n🟢 [USER BET] Period: ${periodId}`);
                userBets.forEach((bet, idx) => {
                    console.log(`  Bet #${idx + 1}:`, bet);
                });
            } else {
                console.log(`\n⚪ [NO USER BET] Period: ${periodId}`);
            }
        }
        
        // Simulate unique user count
        const userCountInfo = await simulateGetUniqueUserCount(gameType, duration, currentPeriodId);
        console.log(`\n👥 Unique user count: ${userCountInfo.count} (users: ${userCountInfo.uniqueUsers.join(', ')})`);
        console.log(`👥 Total bets: ${userCountInfo.totalBets}`);
        const protectionMode = userCountInfo.count < ENHANCED_USER_THRESHOLD;
        console.log(`🛡️ Protection mode triggered? ${protectionMode} (threshold: ${ENHANCED_USER_THRESHOLD})`);

        // Simulate protection result selection
        if (protectionMode) {
            const prot = await simulateSelectProtectedResultWithExposure(gameType, duration, currentPeriodId);
            console.log(`\n🛡️ [PROTECTION LOGIC] Mode: ${prot.mode}`);
            console.log(`🛡️ Selected result number: ${prot.selected}`);
            if (prot.mode === 'zero-exposure') {
                console.log(`🛡️ Zero-exposure numbers: [${prot.zeroExposureNumbers.join(', ')}]`);
            }
            if (prot.mode === 'force-lose') {
                console.log(`🛡️ Numbers user did NOT bet on: [${prot.losingNumbers.join(', ')}]`);
            }
            // Simulate if your bet would win or lose
            userBets.forEach((bet, idx) => {
                const win = simulateBetWin(bet, prot.selected);
                console.log(`  Bet #${idx + 1} would ${win ? 'WIN' : 'LOSE'} for result number ${prot.selected}`);
            });
        } else {
            console.log('\n🟢 [NO PROTECTION] Normal result selection would occur.');
        }

        // Check both exposure key patterns
        console.log('\n🔍 [EXPOSURE KEY CHECK]');
        const exposureKey1 = `exposure:${gameType}:${duration}:${currentPeriodId}`;
        const exposureKey2 = `duewin:exposure:${gameType}:${duration}:${currentPeriodId}`;
        const exposure1 = await redis.hGetAll(exposureKey1);
        const exposure2 = await redis.hGetAll(exposureKey2);
        console.log(`📊 Exposure key 1 (${exposureKey1}):`, exposure1);
        console.log(`📊 Exposure key 2 (${exposureKey2}):`, exposure2);
        
        console.log('\n🔍 [CURRENT_PERIOD_CHECK] ==========================================');
        console.log('🔍 [CURRENT_PERIOD_CHECK] Current period and user bet check completed');
        console.log('🔍 [CURRENT_PERIOD_CHECK] ==========================================');
        
    } catch (error) {
        console.error('❌ Error checking current period and user bet:', error);
    } finally {
        process.exit(0);
    }
}

// Run the check
checkCurrentPeriodAndUserBet(); 