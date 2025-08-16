#!/usr/bin/env node
/**
 * Check scheduler status and Redis data for period 20250808000000044
 */

const { getRedisHelper } = require('./config/unifiedRedisManager');

async function checkSchedulerStatus() {
    console.log('🔍 [SCHEDULER_CHECK] ===== CHECKING SCHEDULER STATUS =====');
    
    const periodId = '20250808000000044';
    const duration = 30;
    const durationKey = '30s';
    
    try {
        console.log(`🔍 [SCHEDULER_CHECK] Checking Redis data for period: ${periodId}`);
        
        // Check all Redis keys for this period
        const keysToCheck = [
            `wingo:${durationKey}:${periodId}:result`,
            `wingo:${durationKey}:${periodId}:result:override`,
            `wingo:${periodId}:admin:override`,
            `wingo:result:${periodId}:forced`,
            `game:wingo:${durationKey}:${periodId}:admin_result`,
            `wingo:${durationKey}:${periodId}:admin_meta`,
            `game_scheduler:wingo:${duration}:current`,
            `game_scheduler:wingo:${duration}:last_processed`
        ];
        
        console.log('\n🔍 [SCHEDULER_CHECK] === REDIS KEY STATUS ===');
        for (const key of keysToCheck) {
            try {
                const value = await getRedisHelper().get(key);
                if (value) {
                    console.log(`✅ ${key}: EXISTS`);
                    try {
                        const parsed = JSON.parse(value);
                        console.log(`   Data: ${JSON.stringify(parsed, null, 2)}`);
                    } catch {
                        console.log(`   Data: ${value}`);
                    }
                } else {
                    console.log(`❌ ${key}: NOT FOUND`);
                }
            } catch (error) {
                console.log(`⚠️  ${key}: ERROR - ${error.message}`);
            }
        }
        
        // Check database for this period
        console.log('\n🔍 [SCHEDULER_CHECK] === DATABASE STATUS ===');
        const { GamePeriod, BetResultWingo } = require('./models');
        
        try {
            const dbPeriod = await GamePeriod.findOne({
                where: { period_id: periodId, game_type: 'wingo' }
            });
            
            if (dbPeriod) {
                console.log(`✅ Period found in database:`);
                console.log(`   Period ID: ${dbPeriod.period_id}`);
                console.log(`   Is Completed: ${dbPeriod.is_completed}`);
                console.log(`   Start Time: ${dbPeriod.start_time}`);
                console.log(`   End Time: ${dbPeriod.end_time}`);
                console.log(`   Created At: ${dbPeriod.createdAt}`);
                console.log(`   Updated At: ${dbPeriod.updatedAt}`);
            } else {
                console.log(`❌ Period NOT found in database`);
            }
        } catch (dbError) {
            console.log(`⚠️  Database error: ${dbError.message}`);
        }
        
        try {
            const betResult = await BetResultWingo.findOne({
                where: { period_id: periodId }
            });
            
            if (betResult) {
                console.log(`✅ Bet result found in database:`);
                console.log(`   Period ID: ${betResult.period_id}`);
                console.log(`   Number: ${betResult.number}`);
                console.log(`   Color: ${betResult.color}`);
                console.log(`   Size: ${betResult.size}`);
                console.log(`   Is Override: ${betResult.is_override}`);
                console.log(`   Override By: ${betResult.override_by}`);
            } else {
                console.log(`❌ Bet result NOT found in database`);
            }
        } catch (dbError) {
            console.log(`⚠️  Database error: ${dbError.message}`);
        }
        
        // Check scheduler timing
        console.log('\n🔍 [SCHEDULER_CHECK] === SCHEDULER TIMING ===');
        const moment = require('moment-timezone');
        
        const dateStr = periodId.substring(0, 8);
        const sequenceStr = periodId.substring(8);
        const sequenceNumber = parseInt(sequenceStr, 10);
        
        const periodStart = moment.tz(`${dateStr}`, 'YYYYMMDD', 'Asia/Kolkata')
            .add(sequenceNumber * duration, 'seconds');
        const periodEnd = moment(periodStart).add(duration, 'seconds');
        const now = moment().tz('Asia/Kolkata');
        
        console.log(`Period Start: ${periodStart.format('YYYY-MM-DD HH:mm:ss')} IST`);
        console.log(`Period End:   ${periodEnd.format('YYYY-MM-DD HH:mm:ss')} IST`);
        console.log(`Current Time: ${now.format('YYYY-MM-DD HH:mm:ss')} IST`);
        
        const secondsSinceEnd = now.diff(periodEnd, 'seconds');
        console.log(`Time since period ended: ${secondsSinceEnd} seconds`);
        
        if (secondsSinceEnd > 0) {
            console.log(`✅ Period has ended - scheduler should have processed this`);
        } else {
            console.log(`⏳ Period is still active or future`);
        }
        
        console.log('\n🔍 [SCHEDULER_CHECK] ===== CHECK COMPLETE =====');
        
    } catch (error) {
        console.error('❌ [SCHEDULER_CHECK] Error:', error);
    } finally {
        process.exit(0);
    }
}

checkSchedulerStatus();