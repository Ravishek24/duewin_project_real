#!/usr/bin/env node
/**
 * Test admin set result on a fresh future period
 */

async function testAdminFreshPeriod() {
    console.log('🧪 [FRESH_TEST] ===== TESTING ADMIN SET ON FRESH PERIOD =====');
    
    try {
        const moment = require('moment-timezone');
        
        // Calculate a future period (add 5 minutes to current time)
        const now = moment().tz('Asia/Kolkata');
        const futureTime = moment(now).add(5, 'minutes');
        
        // Calculate period ID for future time
        const dateStr = futureTime.format('YYYYMMDD');
        const startOfDay = moment.tz(dateStr, 'YYYYMMDD', 'Asia/Kolkata');
        const secondsFromStart = futureTime.diff(startOfDay, 'seconds');
        const periodDuration = 30; // 30 seconds
        const sequenceNumber = Math.floor(secondsFromStart / periodDuration);
        const futurePeriodId = dateStr + sequenceNumber.toString().padStart(9, '0');
        
        console.log(`🧪 [FRESH_TEST] Current time: ${now.format('YYYY-MM-DD HH:mm:ss')} IST`);
        console.log(`🧪 [FRESH_TEST] Future time: ${futureTime.format('YYYY-MM-DD HH:mm:ss')} IST`);
        console.log(`🧪 [FRESH_TEST] Future period ID: ${futurePeriodId}`);
        
        // Check if this period already exists in DB
        const { GamePeriod, BetResultWingo } = require('./models');
        
        const existingPeriod = await GamePeriod.findOne({
            where: { period_id: futurePeriodId, game_type: 'wingo' }
        });
        
        const existingResult = await BetResultWingo.findOne({
            where: { period_id: futurePeriodId }
        });
        
        console.log(`🧪 [FRESH_TEST] Period exists in DB: ${existingPeriod ? 'YES' : 'NO'}`);
        console.log(`🧪 [FRESH_TEST] Result exists in DB: ${existingResult ? 'YES' : 'NO'}`);
        
        if (!existingPeriod && !existingResult) {
            console.log('\n✅ [FRESH_TEST] This is a FRESH period - perfect for testing!');
            console.log('\n🧪 [FRESH_TEST] === SUGGESTED TEST STEPS ===');
            console.log('1. Use this period ID in your admin panel:');
            console.log(`   Period ID: ${futurePeriodId}`);
            console.log('   Duration: 30');
            console.log('   Number: 7 (for example)');
            console.log('');
            console.log('2. Set the admin result BEFORE the period ends');
            console.log(`   Period will end at: ${futureTime.format('YYYY-MM-DD HH:mm:ss')} IST`);
            console.log('');
            console.log('3. Wait for the scheduler to process it');
            console.log('');
            console.log('4. Verify the admin result was used');
            
            console.log('\n🧪 [FRESH_TEST] === CURL COMMAND FOR TESTING ===');
            console.log('curl -X POST "http://your-domain/api/admin/games/wingo/set-result" \\');
            console.log('  -H "Content-Type: application/json" \\');
            console.log('  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\');
            console.log('  -d \'{\n    "periodId": "' + futurePeriodId + '",\n    "number": 7,\n    "duration": 30\n  }\'');
            
        } else {
            console.log('\n⚠️  [FRESH_TEST] This period already has data - let\'s try another one');
            
            // Try another future period
            const furtherFuture = moment(futureTime).add(2, 'minutes');
            const furtherDateStr = furtherFuture.format('YYYYMMDD');
            const furtherStartOfDay = moment.tz(furtherDateStr, 'YYYYMMDD', 'Asia/Kolkata');
            const furtherSecondsFromStart = furtherFuture.diff(furtherStartOfDay, 'seconds');
            const furtherSequenceNumber = Math.floor(furtherSecondsFromStart / periodDuration);
            const furtherPeriodId = furtherDateStr + furtherSequenceNumber.toString().padStart(9, '0');
            
            console.log(`🧪 [FRESH_TEST] Alternative period ID: ${furtherPeriodId}`);
            console.log(`🧪 [FRESH_TEST] Alternative time: ${furtherFuture.format('YYYY-MM-DD HH:mm:ss')} IST`);
        }
        
        console.log('\n🧪 [FRESH_TEST] ===== TEST PLAN COMPLETE =====');
        
    } catch (error) {
        console.error('❌ [FRESH_TEST] Error:', error);
    } finally {
        process.exit(0);
    }
}

testAdminFreshPeriod();