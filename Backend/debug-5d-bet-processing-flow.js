const gameLogicService = require('./services/gameLogicService');

async function debug5DBetProcessingFlow() {
    try {
        console.log('🔍 [DEBUG_5D_FLOW] Starting 5D bet processing flow debug...');
        
        // Initialize models
        await gameLogicService.ensureModelsInitialized();
        console.log('✅ [DEBUG_5D_FLOW] Models initialized');
        
        // Get models from gameLogicService
        const models = gameLogicService.models;
        
        // 5D has 4 durations: 30s, 60s, 180s, 300s
        const durations = [30, 60, 180, 300];
        
        // Find recent 5D period from any duration
        console.log('\n📊 [DEBUG_5D_FLOW] Searching for recent 5D results across all durations...');
        let recentResult = null;
        let foundDuration = null;
        
        for (const duration of durations) {
            const result = await models.BetResult5D.findOne({
                where: { duration: duration },
                order: [['created_at', 'DESC']]
            });
            
            if (result) {
                console.log(`📊 [DEBUG_5D_FLOW] Found result for duration ${duration}s: period ${result.bet_number}`);
                if (!recentResult || result.created_at > recentResult.created_at) {
                    recentResult = result;
                    foundDuration = duration;
                }
            }
        }
        
        if (!recentResult) {
            console.log('❌ [DEBUG_5D_FLOW] No recent 5D results found in any duration');
            return;
        }
        
        const periodId = recentResult.bet_number;
        const duration = foundDuration;
        console.log(`🔍 [DEBUG_5D_FLOW] Using most recent period: ${periodId} (duration: ${duration}s)`);
        
        // Step 1: Check if bets exist for this period
        console.log('\n📊 [DEBUG_5D_FLOW] Step 1: Checking bets for period...');
        const bets = await gameLogicService.getBetsFromHash('5d', duration, periodId, 'default');
        console.log(`📊 [DEBUG_5D_FLOW] Found ${bets.length} bets for period ${periodId} (duration: ${duration}s)`);
        
        // Step 1.5: Check if there are any bets in the database for this period
        console.log('\n📊 [DEBUG_5D_FLOW] Step 1.5: Checking database for bets...');
        const dbBets = await models.BetRecord5D.findAll({
            where: { bet_number: periodId },
            order: [['created_at', 'DESC']]
        });
        console.log(`📊 [DEBUG_5D_FLOW] Found ${dbBets.length} bets in database for period ${periodId}`);
        
        if (dbBets.length > 0) {
            console.log(`📊 [DEBUG_5D_FLOW] Database bets:`, dbBets.map(bet => ({
                id: bet.id,
                userId: bet.user_id,
                status: bet.status,
                betType: bet.bet_type,
                betValue: bet.bet_value,
                amount: bet.bet_amount,
                createdAt: bet.created_at
            })));
        }
        
        if (bets.length === 0 && dbBets.length === 0) {
            console.log('❌ [DEBUG_5D_FLOW] No bets found in Redis OR database - this is why status is not updating!');
            return;
        }
        
        if (bets.length === 0 && dbBets.length > 0) {
            console.log('⚠️ [DEBUG_5D_FLOW] Bets exist in database but not in Redis - this is the issue!');
            console.log('⚠️ [DEBUG_5D_FLOW] The bet processing function only looks in Redis, not database!');
        }
        
        // Step 2: Check bet status before processing
        console.log('\n📊 [DEBUG_5D_FLOW] Step 2: Checking current bet status...');
        const betStatuses = dbBets;
        
        console.log(`📊 [DEBUG_5D_FLOW] Database bet statuses:`, betStatuses.map(bet => ({
            id: bet.id,
            userId: bet.user_id,
            status: bet.status,
            betType: bet.bet_type,
            betValue: bet.bet_value,
            amount: bet.bet_amount
        })));
        
        // Step 3: Get the result for this period
        console.log('\n📊 [DEBUG_5D_FLOW] Step 3: Getting result for period...');
        const gameResult = {
            A: recentResult.result_a,
            B: recentResult.result_b,
            C: recentResult.result_c,
            D: recentResult.result_d,
            E: recentResult.result_e
        };
        console.log(`📊 [DEBUG_5D_FLOW] Game result:`, gameResult);
        
        // Step 4: Test win condition for first bet
        console.log('\n📊 [DEBUG_5D_FLOW] Step 4: Testing win condition for first bet...');
        const firstBet = dbBets[0]; // Use database bet instead of Redis bet
        console.log(`📊 [DEBUG_5D_FLOW] First bet:`, firstBet);
        
        const isWin = gameLogicService.checkFiveDWin(firstBet.bet_type, firstBet.bet_value, gameResult);
        console.log(`📊 [DEBUG_5D_FLOW] Win check result: ${isWin}`);
        
        // Step 5: Test winnings calculation
        console.log('\n📊 [DEBUG_5D_FLOW] Step 5: Testing winnings calculation...');
        const winnings = gameLogicService.calculateWinnings(firstBet, gameResult, '5d');
        console.log(`📊 [DEBUG_5D_FLOW] Winnings: ${winnings}`);
        
        // Step 6: Test actual bet processing with transaction
        console.log('\n📊 [DEBUG_5D_FLOW] Step 6: Testing actual bet processing...');
        const transaction = await models.sequelize.transaction();
        
        try {
            console.log('🔍 [DEBUG_5D_FLOW] Starting bet processing transaction...');
            const winners = await gameLogicService.processWinningBetsWithTimeline('5d', duration, periodId, 'default', gameResult, transaction);
            
            console.log(`📊 [DEBUG_5D_FLOW] Bet processing completed. Winners:`, winners);
            
            // Check if transaction was committed
            if (transaction.finished) {
                console.log('❌ [DEBUG_5D_FLOW] Transaction was already finished - this might be the issue!');
            } else {
                console.log('✅ [DEBUG_5D_FLOW] Transaction is still active - committing...');
                await transaction.commit();
                console.log('✅ [DEBUG_5D_FLOW] Transaction committed successfully');
            }
            
        } catch (error) {
            console.error('❌ [DEBUG_5D_FLOW] Bet processing error:', error.message);
            await transaction.rollback();
            throw error;
        }
        
        // Step 7: Check bet status after processing
        console.log('\n📊 [DEBUG_5D_FLOW] Step 7: Checking bet status after processing...');
        const updatedBetStatuses = await models.BetRecord5D.findAll({
            where: { bet_number: periodId },
            order: [['created_at', 'DESC']]
        });
        
        console.log(`📊 [DEBUG_5D_FLOW] Updated database bet statuses:`, updatedBetStatuses.map(bet => ({
            id: bet.id,
            userId: bet.user_id,
            status: bet.status,
            betType: bet.bet_type,
            betValue: bet.bet_value,
            amount: bet.bet_amount
        })));
        
        // Step 8: Check if any statuses changed
        const beforeStatuses = betStatuses.map(b => b.status);
        const afterStatuses = updatedBetStatuses.map(b => b.status);
        
        console.log('\n📊 [DEBUG_5D_FLOW] Step 8: Status comparison...');
        console.log(`📊 [DEBUG_5D_FLOW] Before: ${beforeStatuses.join(', ')}`);
        console.log(`📊 [DEBUG_5D_FLOW] After:  ${afterStatuses.join(', ')}`);
        
        const changedCount = beforeStatuses.filter((status, index) => status !== afterStatuses[index]).length;
        console.log(`📊 [DEBUG_5D_FLOW] Statuses changed: ${changedCount}`);
        
        if (changedCount === 0) {
            console.log('❌ [DEBUG_5D_FLOW] NO STATUS CHANGES DETECTED - This confirms the issue!');
        } else {
            console.log('✅ [DEBUG_5D_FLOW] Status changes detected - processing is working!');
        }
        
    } catch (error) {
        console.error('❌ [DEBUG_5D_FLOW] Error:', error);
    } finally {
        process.exit(0);
    }
}

debug5DBetProcessingFlow(); 