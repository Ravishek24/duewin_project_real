const { getPreCalculated5DResult, calculateResultWithVerification } = require('./services/gameLogicService');

async function debug5DBetSettlementTiming() {
    try {
        console.log('🔍 [DEBUG_5D_SETTLEMENT_TIMING] Starting 5D bet settlement timing debug...');
        
        // Test parameters
        const gameType = 'fiveD';
        const duration = 180; // Test with 180 seconds period
        const periodId = '20250816000000237'; // Use a recent period ID
        const timeline = 'default';
        
        console.log('📋 [DEBUG_5D_SETTLEMENT_TIMING] Test parameters:', {
            gameType, duration, periodId, timeline
        });
        
        // Step 1: Test result retrieval multiple times to see if it changes
        console.log('\n🔍 [STEP_1] Testing result consistency over multiple calls...');
        
        for (let i = 1; i <= 5; i++) {
            console.log(`\n📊 [CALL_${i}] Testing getPreCalculated5DResult...`);
            const preCalcResult = await getPreCalculated5DResult(gameType, duration, periodId, timeline);
            
            if (preCalcResult) {
                console.log(`✅ [CALL_${i}] Result: ${preCalcResult.A},${preCalcResult.B},${preCalcResult.C},${preCalcResult.D},${preCalcResult.E}`);
            } else {
                console.log(`❌ [CALL_${i}] No result found`);
            }
            
            // Small delay between calls
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Step 2: Test calculateResultWithVerification multiple times
        console.log('\n🔍 [STEP_2] Testing calculateResultWithVerification consistency over multiple calls...');
        
        for (let i = 1; i <= 5; i++) {
            console.log(`\n📊 [CALL_${i}] Testing calculateResultWithVerification...`);
            const resultWithVerification = await calculateResultWithVerification(gameType, duration, periodId, timeline);
            
            if (resultWithVerification.success && resultWithVerification.result) {
                const result = resultWithVerification.result;
                console.log(`✅ [CALL_${i}] Result: ${result.A},${result.B},${result.C},${result.D},${result.E} | Source: ${resultWithVerification.source}`);
            } else {
                console.log(`❌ [CALL_${i}] No result found`);
            }
            
            // Small delay between calls
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Step 3: Test with different bet types to see if they trigger different paths
        console.log('\n🔍 [STEP_3] Testing if different bet types trigger different result paths...');
        
        const betTypes = ['SUM', 'POSITION', 'SUM_SIZE', 'POSITION_SIZE'];
        const betValues = ['25', 'A_5', 'big', 'A_big'];
        
        for (let i = 0; i < betTypes.length; i++) {
            const betType = betTypes[i];
            const betValue = betValues[i];
            
            console.log(`\n📊 [BET_TYPE_${i + 1}] Testing bet type: ${betType}:${betValue}`);
            
            // Simulate what happens when this bet type is processed
            // Check if it would use the same result
            const preCalcResult = await getPreCalculated5DResult(gameType, duration, periodId, timeline);
            
            if (preCalcResult) {
                console.log(`✅ [BET_TYPE_${i + 1}] Would use result: ${preCalcResult.A},${preCalcResult.B},${preCalcResult.C},${preCalcResult.D},${preCalcResult.E}`);
                
                // Simulate win check for this bet type
                let wouldWin = false;
                switch (betType) {
                    case 'SUM':
                        wouldWin = (preCalcResult.A + preCalcResult.B + preCalcResult.C + preCalcResult.D + preCalcResult.E) === parseInt(betValue);
                        break;
                    case 'POSITION':
                        const [position, value] = betValue.split('_');
                        wouldWin = preCalcResult[position] === parseInt(value);
                        break;
                    case 'SUM_SIZE':
                        const sum = preCalcResult.A + preCalcResult.B + preCalcResult.C + preCalcResult.D + preCalcResult.E;
                        const isBig = sum >= 22;
                        wouldWin = (betValue === 'big' && isBig) || (betValue === 'small' && !isBig);
                        break;
                    case 'POSITION_SIZE':
                        const [pos, size] = betValue.split('_');
                        const posValue = preCalcResult[pos];
                        const isPosBig = posValue >= 5;
                        wouldWin = (size === 'big' && isPosBig) || (size === 'small' && !isPosBig);
                        break;
                }
                
                console.log(`🎯 [BET_TYPE_${i + 1}] Bet ${betType}:${betValue} would ${wouldWin ? 'WIN' : 'LOSE'} with result ${preCalcResult.A},${preCalcResult.B},${preCalcResult.C},${preCalcResult.D},${preCalcResult.E}`);
            } else {
                console.log(`❌ [BET_TYPE_${i + 1}] No result available for this bet type`);
            }
        }
        
        console.log('\n🎯 [DEBUG_5D_SETTLEMENT_TIMING] Debug completed');
        
    } catch (error) {
        console.error('❌ [DEBUG_5D_SETTLEMENT_TIMING] Error during debug:', error);
    }
}

// Run debug if this file is executed directly
if (require.main === module) {
    debug5DBetSettlementTiming();
}

module.exports = { debug5DBetSettlementTiming };
