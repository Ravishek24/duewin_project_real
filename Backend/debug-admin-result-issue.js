#!/usr/bin/env node
/**
 * Debug tool to check why admin-set results are not being saved to database
 */

const unifiedRedis = require('./config/unifiedRedisManager');
function getRedisHelper() { return unifiedRedis.getHelper(); }

async function debugAdminResultIssue() {
    console.log('🔍 [DEBUG] ===== DEBUGGING ADMIN RESULT ISSUE =====');
    
    try {
        // Test period ID - replace with actual period you're testing
        const periodId = '20240101000001'; // Replace with your test period
        const duration = 30;
        const gameType = 'wingo';
        
        console.log('\n🔍 [DEBUG] === STEP 1: CHECK REDIS KEYS ===');
        
        // Check all possible Redis keys where admin result might be stored
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        const redisKeys = [
            `wingo:${durationKey}:${periodId}:result`,
            `wingo:${durationKey}:${periodId}:result:override`,
            `wingo:${periodId}:admin:override`,
            `wingo:result:${periodId}:forced`,
            `game:wingo:${durationKey}:${periodId}:admin_result`,
            `wingo:${durationKey}:${periodId}:admin_meta`
        ];
        
        console.log('🔍 [DEBUG] Checking Redis keys:');
        for (const key of redisKeys) {
            try {
                const value = await getRedisHelper().get(key);
                if (value) {
                    console.log(`✅ [DEBUG] Found key: ${key}`);
                    console.log(`📄 [DEBUG] Value:`, JSON.parse(value));
                } else {
                    console.log(`❌ [DEBUG] Missing key: ${key}`);
                }
            } catch (error) {
                console.log(`⚠️ [DEBUG] Error checking key ${key}:`, error.message);
            }
        }
        
        console.log('\n🔍 [DEBUG] === STEP 2: CHECK DATABASE ===');
        
        // Check if result exists in database
        const { connectDB } = require('./config/db');
        await connectDB();
        
        // Import and initialize models properly
        const gameLogicService = require('./services/gameLogicService');
        await gameLogicService.ensureModelsInitialized();
        const models = gameLogicService.models;
        
        console.log('🔍 [DEBUG] Models initialized:', !!models);
        console.log('🔍 [DEBUG] BetResultWingo available:', !!models.BetResultWingo);
        
        const dbResult = await models.BetResultWingo.findOne({
            where: {
                bet_number: periodId,
                duration: duration
            }
        });
        
        if (dbResult) {
            console.log('✅ [DEBUG] Result found in database:');
            console.log(`📄 [DEBUG] Number: ${dbResult.result_of_number}, Color: ${dbResult.result_of_color}, Size: ${dbResult.result_of_size}`);
        } else {
            console.log('❌ [DEBUG] Result NOT found in database');
        }
        
        console.log('\n🔍 [DEBUG] === STEP 3: MANUAL SCHEDULER SIMULATION ===');
        
        console.log('🔍 [DEBUG] Manually calling processGameResults...');
        console.log(`🔍 [DEBUG] Parameters: gameType=${gameType}, duration=${duration}, periodId=${periodId}`);
        
        try {
            const result = await gameLogicService.processGameResults(
                gameType,
                duration, 
                periodId,
                'default'
            );
            
            console.log('\n✅ [DEBUG] Manual processing completed!');
            console.log('📄 [DEBUG] Result:', JSON.stringify(result, null, 2));
            
            if (result.success) {
                console.log('✅ [DEBUG] Processing was successful');
                
                // Check if admin result was detected
                if (result.isAdminSet) {
                    console.log('🔐 [DEBUG] ✅ Admin result was detected and used!');
                    console.log(`📄 [DEBUG] Admin User: ${result.adminUserId}`);
                    console.log(`📄 [DEBUG] Request ID: ${result.requestId}`);
                    
                    // Check if it was saved to database
                    const newDbResult = await models.BetResultWingo.findOne({
                        where: {
                            bet_number: periodId,
                            duration: duration
                        }
                    });
                    
                    if (newDbResult) {
                        console.log('✅ [DEBUG] Result now saved to database!');
                        console.log(`📄 [DEBUG] DB Result: Number ${newDbResult.result_of_number}, Color ${newDbResult.result_of_color}, Size ${newDbResult.result_of_size}`);
                    } else {
                        console.log('❌ [DEBUG] Result still not in database - there\'s a database save issue');
                    }
                } else {
                    console.log('❌ [DEBUG] Admin result was NOT detected');
                    console.log('❌ [DEBUG] This means Redis keys are wrong or result is not in correct format');
                }
            } else {
                console.log('❌ [DEBUG] Processing failed:', result.message);
            }
            
        } catch (processError) {
            console.error('❌ [DEBUG] Error in manual processing:', processError);
        }
        
        console.log('\n🔍 [DEBUG] === DIAGNOSIS SUMMARY ===');
        console.log('📋 [DEBUG] Based on the above results:');
        console.log('📋 [DEBUG] 1. If Redis keys are missing → Admin controller has an issue');
        console.log('📋 [DEBUG] 2. If Redis keys exist but not detected → Key format mismatch');
        console.log('📋 [DEBUG] 3. If detected but not saved to DB → Database save issue');
        console.log('📋 [DEBUG] 4. If manual processing works → Scheduler timing issue');
        
    } catch (error) {
        console.error('❌ [DEBUG] Fatal error:', error);
    }
    
    process.exit(0);
}

// Run the debug
debugAdminResultIssue().catch(console.error);