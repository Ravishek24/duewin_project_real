#!/usr/bin/env node
/**
 * Check the existing database result for period 20250808000000044
 */

async function checkDbResult() {
    console.log('🔍 [DB_CHECK] ===== CHECKING DATABASE RESULT =====');
    
    const periodId = '20250808000000044';
    
    try {
        // Import models
        const { GamePeriod, BetResultWingo, BetRecordWingo } = require('./models');
        
        console.log(`🔍 [DB_CHECK] Checking database for period: ${periodId}`);
        
        // Check GamePeriod
        console.log('\n🔍 [DB_CHECK] === GAME PERIOD ===');
        const gamePeriod = await GamePeriod.findOne({
            where: { period_id: periodId, game_type: 'wingo' }
        });
        
        if (gamePeriod) {
            console.log('✅ [DB_CHECK] GamePeriod found:');
            console.log(`   Period ID: ${gamePeriod.period_id}`);
            console.log(`   Game Type: ${gamePeriod.game_type}`);
            console.log(`   Is Completed: ${gamePeriod.is_completed}`);
            console.log(`   Start Time: ${gamePeriod.start_time}`);
            console.log(`   End Time: ${gamePeriod.end_time}`);
            console.log(`   Created At: ${gamePeriod.createdAt}`);
            console.log(`   Updated At: ${gamePeriod.updatedAt}`);
            console.log(`   Duration: ${gamePeriod.duration}`);
            console.log(`   Timeline: ${gamePeriod.timeline}`);
        } else {
            console.log('❌ [DB_CHECK] GamePeriod not found');
        }
        
        // Check BetResultWingo
        console.log('\n🔍 [DB_CHECK] === BET RESULT ===');
        const betResult = await BetResultWingo.findOne({
            where: { period_id: periodId }
        });
        
        if (betResult) {
            console.log('✅ [DB_CHECK] BetResultWingo found:');
            console.log(`   ID: ${betResult.id}`);
            console.log(`   Period ID: ${betResult.period_id}`);
            console.log(`   Number: ${betResult.number}`);
            console.log(`   Color: ${betResult.color}`);
            console.log(`   Size: ${betResult.size}`);
            console.log(`   Is Override: ${betResult.is_override}`);
            console.log(`   Override By: ${betResult.override_by}`);
            console.log(`   Created At: ${betResult.createdAt}`);
            console.log(`   Updated At: ${betResult.updatedAt}`);
            console.log(`   Timeline: ${betResult.timeline}`);
            console.log(`   Duration: ${betResult.duration}`);
        } else {
            console.log('❌ [DB_CHECK] BetResultWingo not found');
        }
        
        // Check if there are any bets for this period
        console.log('\n🔍 [DB_CHECK] === BET RECORDS ===');
        const betCount = await BetRecordWingo.count({
            where: { bet_number: periodId }
        });
        
        console.log(`📊 [DB_CHECK] Total bets for this period: ${betCount}`);
        
        if (betCount > 0) {
            const sampleBets = await BetRecordWingo.findAll({
                where: { bet_number: periodId },
                limit: 5,
                attributes: ['id', 'user_id', 'bet_type', 'bet_value', 'bet_amount', 'status', 'createdAt']
            });
            
            console.log('📊 [DB_CHECK] Sample bets:');
            sampleBets.forEach((bet, index) => {
                console.log(`   ${index + 1}. User ${bet.user_id}: ${bet.bet_type}/${bet.bet_value} - ${bet.bet_amount} (${bet.status})`);
            });
        }
        
        // Timeline analysis
        console.log('\n🔍 [DB_CHECK] === TIMING ANALYSIS ===');
        const moment = require('moment-timezone');
        
        if (betResult && gamePeriod) {
            const betResultTime = moment(betResult.createdAt).tz('Asia/Kolkata');
            const periodEndTime = moment(gamePeriod.end_time).tz('Asia/Kolkata');
            
            console.log(`Period End Time: ${periodEndTime.format('YYYY-MM-DD HH:mm:ss')} IST`);
            console.log(`Result Created:  ${betResultTime.format('YYYY-MM-DD HH:mm:ss')} IST`);
            
            const timeDiff = betResultTime.diff(periodEndTime, 'seconds');
            console.log(`Time difference: ${timeDiff} seconds after period end`);
            
            if (timeDiff > 0) {
                console.log('✅ [DB_CHECK] Result was created AFTER period ended (normal)');
            } else {
                console.log('⚠️  [DB_CHECK] Result was created BEFORE period ended (unusual)');
            }
        }
        
        console.log('\n🔍 [DB_CHECK] ===== CHECK COMPLETE =====');
        
    } catch (error) {
        console.error('❌ [DB_CHECK] Error:', error);
    } finally {
        process.exit(0);
    }
}

checkDbResult();