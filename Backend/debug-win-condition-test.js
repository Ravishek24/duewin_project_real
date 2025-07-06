// Standalone win condition test - no database dependencies

// Color mapping function (copied from gameLogicService.js)
const getColorForNumber = (number) => {
    const colorMap = {
        0: 'red_violet',
        1: 'green',
        2: 'red',
        3: 'green',
        4: 'red',
        5: 'green_violet',
        6: 'red',
        7: 'green',
        8: 'red',
        9: 'green'
    };
    
    return colorMap[number] || 'unknown';
};

// Initialize game combinations (copied from gameLogicService.js)
function initializeGameCombinations() {
    console.log('🎲 Initializing game combinations...');
    
    // Initialize Wingo combinations
    global.wingoCombinations = {};
    for (let i = 0; i <= 9; i++) {
        const color = getColorForNumber(i);
        const size = i >= 5 ? 'Big' : 'Small';
        const parity = i % 2 === 0 ? 'even' : 'odd';
        
        global.wingoCombinations[i] = {
            number: i,
            color: color,
            size: size,
            parity: parity,
            winning_conditions: {
                exact: [`NUMBER:${i}`],
                color: [`COLOR:${color}`],
                size: [`SIZE:${size.toLowerCase()}`],
                parity: [`PARITY:${parity}`]
            }
        };
    }
    
    console.log('✅ Game combinations initialized');
    console.log('   - Wingo: 10 combinations');
}

// Check win condition function (copied from gameLogicService.js)
function checkWinCondition(combination, betType, betValue) {
    console.log('🔍 [CHECK_WIN] Testing condition:', {
        combination: combination,
        betType,
        betValue
    });
    
    switch (betType) {
        case 'NUMBER':
            const numberResult = combination.number === parseInt(betValue);
            console.log(`🔍 [CHECK_WIN] NUMBER check: ${combination.number} === ${parseInt(betValue)} = ${numberResult}`);
            return numberResult;
        case 'COLOR':
            // Check color logic
            if (betValue === 'red') {
                const redResult = combination.color === 'red' || combination.color === 'red_violet';
                console.log(`🔍 [CHECK_WIN] RED check: combination.color=${combination.color}, result=${redResult}`);
                return redResult;
            }
            if (betValue === 'green') {
                const greenResult = combination.color === 'green' || combination.color === 'green_violet';
                console.log(`🔍 [CHECK_WIN] GREEN check: combination.color=${combination.color}, result=${greenResult}`);
                return greenResult;
            }
            const otherColorResult = combination.color === betValue;
            console.log(`🔍 [CHECK_WIN] OTHER COLOR check: combination.color=${combination.color} === ${betValue} = ${otherColorResult}`);
            return otherColorResult;
        case 'SIZE':
            const sizeResult = combination.size.toLowerCase() === betValue.toLowerCase();
            console.log(`🔍 [CHECK_WIN] SIZE check: ${combination.size.toLowerCase()} === ${betValue.toLowerCase()} = ${sizeResult}`);
            return sizeResult;
        case 'PARITY':
            const parityResult = combination.parity === betValue;
            console.log(`🔍 [CHECK_WIN] PARITY check: ${combination.parity} === ${betValue} = ${parityResult}`);
            return parityResult;
        default:
            console.log(`🔍 [CHECK_WIN] UNKNOWN bet type: ${betType}`);
            return false;
    }
}

// Check bet win function (copied from gameLogicService.js)
function checkBetWin(bet, result, gameType) {
    try {
        console.log('🎯 [BET_WIN] Checking bet win:', {
            betType: bet.bet_type,
            result: result,
            gameType
        });
        
        const [betType, betValue] = bet.bet_type.split(':');
        console.log('🎯 [BET_WIN] Parsed bet:', { betType, betValue });

        switch (gameType.toLowerCase()) {
            case 'wingo':
            case 'trx_wix':
                // Use in-memory combinations
                if (!global.wingoCombinations) {
                    console.log('⚠️ Wingo combinations not initialized, initializing now...');
                    initializeGameCombinations();
                }
                
                const wingoCombo = global.wingoCombinations[result.number];
                console.log('🎯 [BET_WIN] Found combination for number', result.number, ':', wingoCombo);
                
                if (!wingoCombo) {
                    console.log('❌ [BET_WIN] No combination found!');
                    return false;
                }
                
                const winResult = checkWinCondition(wingoCombo, betType, betValue);
                console.log('🎯 [BET_WIN] Final win result:', winResult);
                return winResult;

            default:
                console.log('❌ [BET_WIN] Unsupported game type:', gameType);
                return false;
        }
    } catch (error) {
        console.error('❌ [BET_WIN] Error checking bet win:', error.message);
        return false;
    }
}

// Main diagnostic function
function testWinCondition() {
    try {
        console.log('🚀 [TEST] Starting win condition test...');
        console.log('🚀 [TEST] ==========================================');
        
        // Test case from the production bug
        const testBet = {
            bet_type: 'COLOR:red',
            user_id: 13,
            bet_amount: 100
        };
        
        const testResult = {
            number: 3,
            color: 'green',
            size: 'Small',
            parity: 'odd'
        };
        
        console.log('📋 [TEST] Test case setup:');
        console.log('   Bet:', testBet);
        console.log('   Result:', testResult);
        console.log('   Expected: User should LOSE (bet RED, result GREEN)');
        console.log('');
        
        // Initialize combinations
        initializeGameCombinations();
        
        // Test the specific combination for number 3
        console.log('🔍 [TEST] Testing number 3 combination:');
        const combo3 = global.wingoCombinations[3];
        console.log('   Combination:', combo3);
        console.log('');
        
        // Test win condition directly
        console.log('🎯 [TEST] Testing checkWinCondition directly:');
        const directResult = checkWinCondition(combo3, 'COLOR', 'red');
        console.log('   Direct result:', directResult);
        console.log('');
        
        // Test through checkBetWin function
        console.log('🎲 [TEST] Testing through checkBetWin function:');
        const betWinResult = checkBetWin(testBet, testResult, 'wingo');
        console.log('   checkBetWin result:', betWinResult);
        console.log('');
        
        // Analysis
        console.log('📊 [ANALYSIS] ==========================================');
        if (directResult === false && betWinResult === false) {
            console.log('✅ [ANALYSIS] Logic is CORRECT - RED bet loses against GREEN result');
        } else {
            console.log('❌ [ANALYSIS] BUG FOUND - Logic incorrectly shows WIN when should be LOSE');
            console.log('   Direct result:', directResult);
            console.log('   BetWin result:', betWinResult);
        }
        
        // Test all numbers to verify color logic
        console.log('');
        console.log('🎨 [COLOR_TEST] Testing all numbers for RED bet:');
        for (let num = 0; num <= 9; num++) {
            const combo = global.wingoCombinations[num];
            const result = checkWinCondition(combo, 'COLOR', 'red');
            console.log(`   Number ${num} (${combo.color}): ${result ? 'WIN' : 'LOSE'}`);
        }
        
        console.log('');
        console.log('🎨 [COLOR_TEST] Testing all numbers for GREEN bet:');
        for (let num = 0; num <= 9; num++) {
            const combo = global.wingoCombinations[num];
            const result = checkWinCondition(combo, 'COLOR', 'green');
            console.log(`   Number ${num} (${combo.color}): ${result ? 'WIN' : 'LOSE'}`);
        }
        
        console.log('');
        console.log('🎯 [TEST] Test completed');
        console.log('🎯 [TEST] ==========================================');
        
    } catch (error) {
        console.error('❌ [TEST] Error in test:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testWinCondition();
console.log('✅ Test completed'); 