const { ensureModelsInitialized } = require('./services/gameLogicService');

async function debugPeriod20250816000000357() {
    try {
        console.log('🔍 [DEBUG_PERIOD_20250816000000357] Starting debug for period 20250816000000357...');
        
        // Initialize models
        const models = await ensureModelsInitialized();
        console.log('✅ Models initialized');
        
        const periodId = '20250816000000357';
        const gameType = 'fiveD';
        const duration = 180;
        
        console.log('📋 [DEBUG_PERIOD_20250816000000357] Search parameters:', {
            periodId, gameType, duration
        });
        
        // Step 1: Check BetResult5D (period results)
        console.log('\n🔍 [STEP_1] Checking BetResult5D (period results)...');
        try {
            const betResult = await models.BetResult5D.findOne({
                where: {
                    bet_number: periodId,
                    duration: duration
                }
            });
            
            if (betResult) {
                console.log('✅ [STEP_1] BetResult5D found:', {
                    bet_number: betResult.bet_number,
                    result_a: betResult.result_a,
                    result_b: betResult.result_b,
                    result_c: betResult.result_c,
                    result_d: betResult.result_d,
                    result_e: betResult.result_e,
                    total_sum: betResult.total_sum,
                    duration: betResult.duration,
                    timeline: betResult.timeline,
                    created_at: betResult.created_at,
                    updated_at: betResult.updated_at
                });
                
                // Calculate derived values
                const sum = betResult.result_a + betResult.result_b + betResult.result_c + betResult.result_d + betResult.result_e;
                const sum_size = sum >= 22 ? 'big' : 'small';
                const sum_parity = sum % 2 === 0 ? 'even' : 'odd';
                
                console.log('📊 [STEP_1] Derived values:', {
                    calculated_sum: sum,
                    calculated_sum_size: sum_size,
                    calculated_sum_parity: sum_parity,
                    matches_database_sum: sum === betResult.total_sum
                });
                
            } else {
                console.log('❌ [STEP_1] No BetResult5D found for period:', periodId);
            }
        } catch (error) {
            console.error('❌ [STEP_1] Error checking BetResult5D:', error.message);
        }
        
        // Step 2: Check BetRecord5D (user bets)
        console.log('\n🔍 [STEP_2] Checking BetRecord5D (user bets)...');
        try {
            const betRecords = await models.BetRecord5D.findAll({
                where: {
                    bet_number: periodId
                },
                order: [['created_at', 'ASC']]
            });
            
            if (betRecords.length > 0) {
                console.log(`✅ [STEP_2] Found ${betRecords.length} bet records for period ${periodId}:`);
                
                // Group bets by type
                const betsByType = {};
                betRecords.forEach((bet, index) => {
                    const betType = bet.bet_type;
                    if (!betsByType[betType]) {
                        betsByType[betType] = [];
                    }
                    betsByType[betType].push({
                        index: index + 1,
                        bet_id: bet.bet_id,
                        user_id: bet.user_id,
                        bet_type: bet.bet_type,
                        bet_value: bet.bet_value,
                        bet_amount: bet.bet_amount,
                        amount_after_tax: bet.amount_after_tax,
                        status: bet.status,
                        created_at: bet.created_at
                    });
                });
                
                // Display bets grouped by type
                Object.keys(betsByType).forEach(betType => {
                    console.log(`\n📊 [STEP_2] Bet Type: ${betType} (${betsByType[betType].length} bets):`);
                    betsByType[betType].forEach(bet => {
                        console.log(`   ${bet.index}. User ${bet.user_id}: ${bet.bet_type}:${bet.bet_value} | Amount: ₹${bet.bet_amount} | Status: ${bet.status}`);
                    });
                });
                
                // Check for any inconsistencies
                console.log('\n🔍 [STEP_2] Checking for bet inconsistencies...');
                const uniqueBetTypes = Object.keys(betsByType);
                console.log('📊 [STEP_2] Unique bet types found:', uniqueBetTypes);
                
                // Check if any bets have different statuses
                const statuses = [...new Set(betRecords.map(bet => bet.status))];
                console.log('📊 [STEP_2] Bet statuses found:', statuses);
                
            } else {
                console.log('❌ [STEP_2] No BetRecord5D found for period:', periodId);
            }
        } catch (error) {
            console.error('❌ [STEP_2] Error checking BetRecord5D:', error.message);
        }
        
        // Step 3: Check if there are multiple result sources
        console.log('\n🔍 [STEP_3] Checking for multiple result sources...');
        try {
            // Check if there are multiple results for the same period
            const allResults = await models.BetResult5D.findAll({
                where: {
                    bet_number: periodId
                }
            });
            
            if (allResults.length > 1) {
                console.log(`⚠️ [STEP_3] Found ${allResults.length} results for period ${periodId}:`);
                allResults.forEach((result, index) => {
                    console.log(`   ${index + 1}. Result: ${result.result_a},${result.result_b},${result.result_c},${result.result_d},${result.result_e} | Timeline: ${result.timeline} | Created: ${result.created_at}`);
                });
            } else if (allResults.length === 1) {
                console.log('✅ [STEP_3] Only one result found for period (consistent)');
            } else {
                console.log('❌ [STEP_3] No results found for period');
            }
        } catch (error) {
            console.error('❌ [STEP_3] Error checking multiple results:', error.message);
        }
        
        // Step 4: Check Redis for any cached results
        console.log('\n🔍 [STEP_4] Checking Redis for cached results...');
        try {
            const { getRedisHelper } = require('./services/gameLogicService');
            const redis = await getRedisHelper();
            
            if (redis) {
                // Check various Redis keys that might contain results
                const redisKeys = [
                    `precalc_5d_result:fiveD:180:default:${periodId}`,
                    `precalc_result_fiveD_180_${periodId}_default`,
                    `game_result:fiveD:180:${periodId}`,
                    `result:fiveD:180:${periodId}`
                ];
                
                for (const key of redisKeys) {
                    const value = await redis.get(key);
                    if (value) {
                        console.log(`✅ [STEP_4] Redis key found: ${key}`);
                        console.log(`📊 [STEP_4] Redis value:`, typeof value === 'string' ? value.substring(0, 200) + '...' : value);
                    } else {
                        console.log(`❌ [STEP_4] Redis key not found: ${key}`);
                    }
                }
            } else {
                console.log('❌ [STEP_4] Redis helper not available');
            }
        } catch (error) {
            console.error('❌ [STEP_4] Error checking Redis:', error.message);
        }
        
        console.log('\n🎯 [DEBUG_PERIOD_20250816000000357] Debug completed');
        
    } catch (error) {
        console.error('❌ [DEBUG_PERIOD_20250816000000357] Error during debug:', error);
    }
}

// Run debug if this file is executed directly
if (require.main === module) {
    debugPeriod20250816000000357();
}

module.exports = { debugPeriod20250816000000357 };
