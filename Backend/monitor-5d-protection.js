const gameLogicService = require('./services/gameLogicService');
const { getSequelizeInstance } = require('./config/db');

async function monitor5DProtection() {
    try {
        console.log('🔍 [5D_MONITOR] Starting 5D Protection Monitor...');
        console.log('🔍 [5D_MONITOR] Press Ctrl+C to stop monitoring');
        console.log('🔍 [5D_MONITOR] ==========================================');

        // Initialize models
        await gameLogicService.ensureModelsInitialized();
        console.log('✅ Models initialized for monitoring');

        // Monitor for new bets and results
        let lastCheck = new Date();
        
        setInterval(async () => {
            try {
                const now = new Date();
                console.log(`\n🕐 [5D_MONITOR] Checking at ${now.toLocaleTimeString()}`);
                
                // Check for recent 5D bets
                const sequelize = await getSequelizeInstance();
                const recentBetsQuery = `
                    SELECT 
                        bet_id, user_id, bet_number, bet_type, bet_amount, 
                        status, created_at, win_amount
                    FROM bet_record_5ds 
                    WHERE created_at > ?
                    ORDER BY created_at DESC
                    LIMIT 10
                `;
                
                const recentBets = await sequelize.query(recentBetsQuery, {
                    replacements: [lastCheck],
                    type: sequelize.QueryTypes.SELECT
                });

                if (recentBets.length > 0) {
                    console.log(`📊 [5D_MONITOR] Found ${recentBets.length} recent 5D bets:`);
                    recentBets.forEach((bet, index) => {
                        console.log(`   ${index + 1}. User ${bet.user_id}: ${bet.bet_type} - ₹${bet.bet_amount} (${bet.status})`);
                    });
                }

                // Check for recent 5D results
                const recentResultsQuery = `
                    SELECT 
                        bet_id, bet_number, result_a, result_b, result_c, result_d, result_e, 
                        total_sum, created_at
                    FROM bet_result_5ds 
                    WHERE created_at > ?
                    ORDER BY created_at DESC
                    LIMIT 5
                `;
                
                const recentResults = await sequelize.query(recentResultsQuery, {
                    replacements: [lastCheck],
                    type: sequelize.QueryTypes.SELECT
                });

                if (recentResults.length > 0) {
                    console.log(`🎲 [5D_MONITOR] Found ${recentResults.length} recent 5D results:`);
                    
                    // Use for...of instead of forEach for async operations
                    for (let index = 0; index < recentResults.length; index++) {
                        const result = recentResults[index];
                        const resultObj = {
                            A: result.result_a,
                            B: result.result_b,
                            C: result.result_c,
                            D: result.result_d,
                            E: result.result_e,
                            sum: result.total_sum
                        };
                        console.log(`   ${index + 1}. Period ${result.bet_number}: ${JSON.stringify(resultObj)}`);
                        
                        // Check if this result shows protection logic
                        if (result.result_a !== undefined) {
                            console.log(`   🔍 [5D_MONITOR] Result A=${result.result_a} - Checking protection logic...`);
                            
                            // Simulate protection query for this period
                            const protectionQuery = `
                                SELECT COUNT(*) as bet_count, bet_type
                                FROM bet_record_5ds 
                                WHERE bet_number = ?
                                AND bet_type LIKE 'POSITION:A_%'
                                GROUP BY bet_type
                            `;
                            
                            const betAnalysis = await sequelize.query(protectionQuery, {
                                replacements: [result.bet_number],
                                type: sequelize.QueryTypes.SELECT
                            });
                            
                            if (betAnalysis.length > 0) {
                                console.log(`   📊 [5D_MONITOR] Position bets in this period:`);
                                betAnalysis.forEach(bet => {
                                    console.log(`      - ${bet.bet_type}: ${bet.bet_count} bets`);
                                });
                                
                                // Check if protection should have been triggered
                                const aBets = betAnalysis.filter(b => b.bet_type.includes('A_'));
                                const hasA0Bet = aBets.some(b => b.bet_type.includes('A_0'));
                                const hasA1to9Bets = aBets.some(b => bet.bet_type.match(/A_[1-9]/));
                                
                                console.log(`   🔍 [5D_MONITOR] Protection Analysis:`);
                                console.log(`      - Has A_0 bet: ${hasA0Bet}`);
                                console.log(`      - Has A_1-9 bets: ${hasA1to9Bets}`);
                                console.log(`      - A bets found: ${aBets.map(b => b.bet_type).join(', ')}`);
                                
                                if (hasA1to9Bets && !hasA0Bet && result.result_a === 0) {
                                    console.log(`   ✅ [5D_MONITOR] PROTECTION WORKING: A=0 selected when betting on A_1-9`);
                                } else if (hasA1to9Bets && !hasA0Bet && result.result_a !== 0) {
                                    console.log(`   ❌ [5D_MONITOR] PROTECTION FAILED: A=${result.result_a} selected instead of A=0`);
                                    
                                    // Get exposure data for this period
                                    try {
                                        const exposureKey = `exposure:5d:60:default:${result.bet_number}`;
                                        const exposureData = await sequelize.query(`
                                            SELECT * FROM redis_cache WHERE key_name = ?
                                        `, {
                                            replacements: [exposureKey],
                                            type: sequelize.QueryTypes.SELECT
                                        });
                                        
                                        if (exposureData.length > 0) {
                                            console.log(`   📊 [5D_MONITOR] Exposure data found for period ${result.bet_number}`);
                                            console.log(`      - Exposure key: ${exposureKey}`);
                                            console.log(`      - Data: ${JSON.stringify(exposureData[0])}`);
                                        } else {
                                            console.log(`   ⚠️ [5D_MONITOR] No exposure data found for period ${result.bet_number}`);
                                        }
                                    } catch (error) {
                                        console.log(`   ❌ [5D_MONITOR] Error getting exposure data: ${error.message}`);
                                    }
                                }
                            }
                        }
                    }
                }

                // Check for recent payouts
                const recentPayoutsQuery = `
                    SELECT 
                        bet_id, user_id, bet_type, bet_amount, win_amount, created_at
                    FROM bet_record_5ds 
                    WHERE status = 'won'
                    AND created_at > ?
                    ORDER BY created_at DESC
                    LIMIT 5
                `;
                
                const recentPayouts = await sequelize.query(recentPayoutsQuery, {
                    replacements: [lastCheck],
                    type: sequelize.QueryTypes.SELECT
                });

                if (recentPayouts.length > 0) {
                    console.log(`💰 [5D_MONITOR] Found ${recentPayouts.length} recent 5D payouts:`);
                    recentPayouts.forEach((payout, index) => {
                        const multiplier = payout.win_amount / payout.bet_amount;
                        console.log(`   ${index + 1}. User ${payout.user_id}: ${payout.bet_type} - ₹${payout.bet_amount} → ₹${payout.win_amount} (${multiplier.toFixed(1)}x)`);
                        
                        // Check if POSITION bet got correct 9x payout
                        if (payout.bet_type.includes('POSITION:')) {
                            if (Math.abs(multiplier - 9.0) < 0.1) {
                                console.log(`   ✅ [5D_MONITOR] CORRECT PAYOUT: 9x for POSITION bet`);
                            } else {
                                console.log(`   ❌ [5D_MONITOR] INCORRECT PAYOUT: ${multiplier.toFixed(1)}x instead of 9x`);
                            }
                        }
                    });
                }

                lastCheck = now;
                
            } catch (error) {
                console.error('❌ [5D_MONITOR] Error in monitoring cycle:', error.message);
            }
        }, 5000); // Check every 5 seconds

    } catch (error) {
        console.error('❌ [5D_MONITOR] Error starting monitor:', error);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 [5D_MONITOR] Stopping monitor...');
    process.exit(0);
});

// Start monitoring
monitor5DProtection().catch(error => {
    console.error('❌ [5D_MONITOR] Failed to start monitor:', error);
    process.exit(1);
}); 