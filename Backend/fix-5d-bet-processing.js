const gameLogicService = require('./services/gameLogicService');
const { ensureModelsInitialized } = require('./services/gameLogicService');

async function fix5DBetProcessing() {
    console.log('🔧 [FIX_5D_BET_PROCESSING] Starting 5D bet processing fix...');
    
    try {
        // Initialize models
        const models = await ensureModelsInitialized();
        
        // Step 1: Find all pending 5D bets
        console.log('\n📊 [FIX_5D_BET_PROCESSING] Step 1: Finding pending 5D bets...');
        const pending5DBets = await models.BetRecord5D.findAll({
            where: {
                status: 'pending'
            },
            order: [['created_at', 'ASC']]
        });
        
        console.log(`📊 [FIX_5D_BET_PROCESSING] Found ${pending5DBets.length} pending 5D bets`);
        
        if (pending5DBets.length === 0) {
            console.log('✅ [FIX_5D_BET_PROCESSING] No pending bets found. System is working correctly.');
            return;
        }
        
        // Step 2: Group bets by period
        const betsByPeriod = {};
        pending5DBets.forEach(bet => {
            if (!betsByPeriod[bet.bet_number]) {
                betsByPeriod[bet.bet_number] = [];
            }
            betsByPeriod[bet.bet_number].push(bet);
        });
        
        console.log(`📊 [FIX_5D_BET_PROCESSING] Bets grouped by ${Object.keys(betsByPeriod).length} periods`);
        
        // Step 3: Process each period
        for (const [periodId, bets] of Object.entries(betsByPeriod)) {
            console.log(`\n🔄 [FIX_5D_BET_PROCESSING] Processing period: ${periodId} (${bets.length} bets)`);
            
            try {
                // Check if result exists for this period
                const existingResult = await models.BetResult5D.findOne({
                    where: { bet_number: periodId }
                });
                
                if (!existingResult) {
                    console.log(`⚠️ [FIX_5D_BET_PROCESSING] No result found for period ${periodId}, skipping...`);
                    continue;
                }
                
                // Create result object from database
                const result = {
                    A: existingResult.result_a,
                    B: existingResult.result_b,
                    C: existingResult.result_c,
                    D: existingResult.result_d,
                    E: existingResult.result_e,
                    sum: existingResult.total_sum
                };
                
                console.log(`📊 [FIX_5D_BET_PROCESSING] Result for period ${periodId}:`, result);
                
                // Process bets for this period
                const db = await gameLogicService.ensureDatabaseInitialized();
                const transaction = await db.transaction();
                
                try {
                    // Process each bet individually
                    for (const bet of bets) {
                        console.log(`🔍 [FIX_5D_BET_PROCESSING] Processing bet ${bet.bet_id}: ${bet.bet_type}`);
                        
                        // Check if bet wins
                        const isWinner = await gameLogicService.checkBetWin(bet, result, '5d');
                        
                        if (isWinner) {
                            // Calculate winnings
                            const winnings = gameLogicService.calculateWinnings(bet, result, '5d');
                            
                            console.log(`💰 [FIX_5D_BET_PROCESSING] Bet WON! Winnings: ₹${winnings}`);
                            
                            // Update user balance
                            await models.User.increment('wallet_balance', {
                                by: winnings,
                                where: { user_id: bet.user_id },
                                transaction: transaction
                            });
                            
                            // Update bet status
                            await bet.update({
                                status: 'won',
                                payout: winnings,
                                win_amount: winnings,
                                wallet_balance_after: parseFloat(bet.wallet_balance_before) + winnings,
                                result: JSON.stringify(result)
                            }, { transaction: transaction });
                            
                            console.log(`✅ [FIX_5D_BET_PROCESSING] Bet ${bet.bet_id} marked as WON`);
                        } else {
                            console.log(`❌ [FIX_5D_BET_PROCESSING] Bet LOST`);
                            
                            // Mark bet as lost
                            await bet.update({
                                status: 'lost',
                                payout: 0,
                                win_amount: 0,
                                wallet_balance_after: bet.wallet_balance_before,
                                result: JSON.stringify(result)
                            }, { transaction: transaction });
                            
                            console.log(`✅ [FIX_5D_BET_PROCESSING] Bet ${bet.bet_id} marked as LOST`);
                        }
                    }
                    
                    // Commit transaction
                    await transaction.commit();
                    console.log(`✅ [FIX_5D_BET_PROCESSING] Period ${periodId} processed successfully`);
                    
                } catch (error) {
                    console.error(`❌ [FIX_5D_BET_PROCESSING] Error processing period ${periodId}:`, error.message);
                    await transaction.rollback();
                }
                
            } catch (periodError) {
                console.error(`❌ [FIX_5D_BET_PROCESSING] Error with period ${periodId}:`, periodError.message);
            }
        }
        
        // Step 4: Verify fix
        console.log('\n📊 [FIX_5D_BET_PROCESSING] Step 4: Verifying fix...');
        const remainingPendingBets = await models.BetRecord5D.findAll({
            where: {
                status: 'pending'
            }
        });
        
        console.log(`📊 [FIX_5D_BET_PROCESSING] Remaining pending bets: ${remainingPendingBets.length}`);
        
        if (remainingPendingBets.length === 0) {
            console.log('✅ [FIX_5D_BET_PROCESSING] All pending bets processed successfully!');
        } else {
            console.log('⚠️ [FIX_5D_BET_PROCESSING] Some bets still pending. Manual review needed.');
        }
        
        console.log('\n🔧 [FIX_5D_BET_PROCESSING] Fix completed.');
        
    } catch (error) {
        console.error('❌ [FIX_5D_BET_PROCESSING] Error during fix:', error);
    }
}

// Run the fix
fix5DBetProcessing().then(() => {
    console.log('✅ [FIX_5D_BET_PROCESSING] Fix script completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ [FIX_5D_BET_PROCESSING] Fix script failed:', error);
    process.exit(1);
}); 