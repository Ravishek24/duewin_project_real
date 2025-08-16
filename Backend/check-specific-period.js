#!/usr/bin/env node
/**
 * Check if scheduler processed the specific admin-set period
 */

const unifiedRedis = require('./config/unifiedRedisManager');
const { connectDB } = require('./config/db');

async function checkSpecificPeriod() {
    console.log('🔍 [CHECK_PERIOD] ===== CHECKING SPECIFIC PERIOD =====');
    
    try {
        const periodId = '20250808000000309'; // The period you just set
        const duration = 30;
        const durationKey = '30s';
        
        // Step 1: Initialize Redis
        await unifiedRedis.initialize();
        const helper = unifiedRedis.getHelper();
        console.log('✅ [CHECK_PERIOD] Redis initialized');
        
        // Step 2: Check what's in Redis
        console.log('\n🔍 [CHECK_PERIOD] === REDIS CONTENT ===');
        
        const redisKeys = [
            `wingo:${durationKey}:${periodId}:result`,
            `wingo:${durationKey}:${periodId}:result:override`,
            `wingo:${periodId}:admin:override`,
            `wingo:result:${periodId}:forced`,
            `game:wingo:${durationKey}:${periodId}:admin_result`,
            `wingo:${durationKey}:${periodId}:admin_meta`
        ];
        
        for (const key of redisKeys) {
            const value = await helper.get(key);
            if (value) {
                console.log('✅ [CHECK_PERIOD] Redis key found:', key);
                console.log('   Value:', value);
            } else {
                console.log('❌ [CHECK_PERIOD] Redis key not found:', key);
            }
        }
        
        // Step 3: Check database
        console.log('\n🔍 [CHECK_PERIOD] === DATABASE CONTENT ===');
        
        try {
            await connectDB();
            console.log('✅ [CHECK_PERIOD] Database connected');
            
            // Initialize models properly
            const modelsIndex = require('./models');
            await modelsIndex.initializeModels();
            console.log('✅ [CHECK_PERIOD] Models initialized');
            
            const BetResultWingo = modelsIndex.BetResultWingo;
            const BetRecordWingo = modelsIndex.BetRecordWingo;
            
            if (!BetResultWingo) {
                console.log('❌ [CHECK_PERIOD] BetResultWingo model not available');
                console.log('⚠️ [CHECK_PERIOD] Skipping database checks, focusing on Redis...');
            } else {
                // Check BetResultWingo table
                const dbResult = await BetResultWingo.findOne({
                    where: {
                        bet_number: periodId,
                        duration: duration
                    }
                });
                
                if (dbResult) {
                    console.log('✅ [CHECK_PERIOD] Database result found:');
                    console.log('   Period ID:', dbResult.bet_number);
                    console.log('   Number:', dbResult.number);
                    console.log('   Color:', dbResult.color);
                    console.log('   Size:', dbResult.size);
                    console.log('   Created:', dbResult.createdAt);
                    console.log('   Source:', dbResult.source || 'not specified');
                } else {
                    console.log('❌ [CHECK_PERIOD] No database result found for period:', periodId);
                }
            }
            
            // Step 4: Check bet records
            console.log('\n🔍 [CHECK_PERIOD] === BET RECORDS ===');
            
            if (!BetRecordWingo) {
                console.log('❌ [CHECK_PERIOD] BetRecordWingo model not available');
            } else {
                const betRecords = await BetRecordWingo.findAll({
                    where: {
                        bet_number: periodId,
                        duration: duration
                    },
                    limit: 5
                });
                
                if (betRecords.length > 0) {
                    console.log(`✅ [CHECK_PERIOD] Found ${betRecords.length} bet records for this period`);
                    betRecords.forEach((bet, index) => {
                        console.log(`   Bet ${index + 1}: User ${bet.user_id}, Amount: ${bet.bet_amount}, Status: ${bet.status}, Win: ${bet.win_amount || 0}`);
                    });
                } else {
                    console.log('❌ [CHECK_PERIOD] No bet records found for period:', periodId);
                }
            }
        } catch (dbError) {
            console.log('❌ [CHECK_PERIOD] Database error:', dbError.message);
            console.log('⚠️ [CHECK_PERIOD] Skipping database checks, focusing on Redis...');
        }
        
        // Step 5: Summary
        console.log('\n🎯 [CHECK_PERIOD] === SUMMARY ===');
        
        const adminResultInRedis = await helper.get(`wingo:${durationKey}:${periodId}:result`);
        
        if (adminResultInRedis) {
            console.log('✅ [CHECK_PERIOD] Admin result found in Redis:');
            console.log('   Admin data:', adminResultInRedis);
            
            const adminData = JSON.parse(adminResultInRedis);
            console.log('   Admin set number:', adminData.number);
            console.log('   Admin set color:', adminData.color);
            console.log('   Admin set size:', adminData.size);
            
            console.log('📋 [CHECK_PERIOD] STATUS: Admin result is properly stored in Redis');
            console.log('⏳ [CHECK_PERIOD] NEXT: Check if scheduler has processed this to database');
            console.log('🎯 [CHECK_PERIOD] EXPECTED: When scheduler runs, it will find this admin result and save to DB');
        } else {
            console.log('❌ [CHECK_PERIOD] Admin result not found in Redis');
            console.log('❌ [CHECK_PERIOD] This suggests the admin set result operation may have failed');
        }
        
    } catch (error) {
        console.error('❌ [CHECK_PERIOD] Error:', error.message);
        console.error('❌ [CHECK_PERIOD] Stack:', error.stack);
    }
}

checkSpecificPeriod().then(() => {
    console.log('🔍 [CHECK_PERIOD] Check completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [CHECK_PERIOD] Fatal error:', error);
    process.exit(1);
});