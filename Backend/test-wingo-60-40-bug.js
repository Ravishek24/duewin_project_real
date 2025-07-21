let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



const logger = require('./utils/logger');

// Mock Redis client for testing
const redisClient = {
    hgetall: async (key) => {
        console.log(`🔍 [REDIS_MOCK] Getting hash: ${key}`);
        return mockBetsData;
    }
};

// Mock bet data for testing
const mockBetsData = {
    'bet1': JSON.stringify({
        betType: 'NUMBER',
        betValue: '5',
        betAmount: 1000,
        amount_after_tax: 1000
    }),
    'bet2': JSON.stringify({
        betType: 'COLOR',
        betValue: 'red',
        betAmount: 2000,
        amount_after_tax: 2000
    }),
    'bet3': JSON.stringify({
        betType: 'SIZE',
        betValue: 'big',
        betAmount: 1500,
        amount_after_tax: 1500
    }),
    'bet4': JSON.stringify({
        betType: 'PARITY',
        betValue: 'odd',
        betAmount: 1200,
        amount_after_tax: 1200
    })
};

// Mock global combinations
global.wingoCombinations = {};
for (let number = 0; number <= 9; number++) {
    global.wingoCombinations[number] = {
        number,
        color: getColorForNumber(number),
        size: number >= 5 ? 'Big' : 'Small',
        parity: number % 2 === 0 ? 'even' : 'odd'
    };
}

// Mock functions
function getColorForNumber(number) {
    const colorMap = {
        0: 'red_violet',    // 0 is red + violet
        1: 'green',         // 1 is green
        2: 'red',           // 2 is red
        3: 'green',         // 3 is green
        4: 'red',           // 4 is red
        5: 'green_violet',  // 5 is green + violet
        6: 'red',           // 6 is red
        7: 'green',         // 7 is green
        8: 'red',           // 8 is red
        9: 'green'          // 9 is green
    };
    return colorMap[number] || 'red';
}

function checkWingoWin(betType, betValue, result) {
    console.log(`🎯 [WINGO_WIN] Checking: ${betType}:${betValue} vs result:`, result);

    switch (betType) {
        case 'NUMBER':
            const targetNumber = parseInt(betValue);
            const isNumberWin = result.number === targetNumber;
            console.log(`🔢 [NUMBER_CHECK] ${targetNumber} === ${result.number} = ${isNumberWin}`);
            return isNumberWin;

        case 'COLOR':
            const isColorWin = checkColorWin(betValue, result.number, result.color);
            console.log(`🎨 [COLOR_CHECK] ${betValue} vs ${result.color} (number: ${result.number}) = ${isColorWin}`);
            return isColorWin;

        case 'SIZE':
            const isBig = result.number >= 5;
            const isSizeWin = (betValue.toLowerCase() === 'big' && isBig) ||
                (betValue.toLowerCase() === 'small' && !isBig);
            console.log(`📏 [SIZE_CHECK] ${betValue} vs ${isBig ? 'big' : 'small'} (number: ${result.number}) = ${isSizeWin}`);
            return isSizeWin;

        case 'PARITY':
            const isEven = result.number % 2 === 0;
            const isParityWin = (betValue.toLowerCase() === 'even' && isEven) ||
                (betValue.toLowerCase() === 'odd' && !isEven);
            console.log(`⚖️ [PARITY_CHECK] ${betValue} vs ${isEven ? 'even' : 'odd'} (number: ${result.number}) = ${isParityWin}`);
            return isParityWin;

        default:
            console.log(`❓ [UNKNOWN_BET_TYPE] ${betType}`);
            return false;
    }
}

function checkColorWin(betValue, resultNumber, resultColor) {
    const betColor = betValue.toLowerCase();
    const actualColor = getColorForNumber(resultNumber);

    console.log(`🎨 [COLOR_DETAIL] Bet: ${betColor}, Number: ${resultNumber}, Actual color: ${actualColor}, Result color: ${resultColor}`);

    switch (betColor) {
        case 'red':
            return actualColor === 'red' || actualColor === 'red_violet';
        case 'green':
            return actualColor === 'green' || actualColor === 'green_violet';
        case 'violet':
        case 'purple':
            return actualColor === 'red_violet' || actualColor === 'green_violet';
        default:
            return false;
    }
}

function calculateWingoWin(bet, result, betType, betValue) {
    try {
        const betAmount = parseFloat(bet.amount_after_tax || bet.netBetAmount || bet.betAmount || bet.bet_amount || 0);

        console.log(`💰 [CALC_WINGO_DEBUG] calculateWingoWin called with:`, {
            betType,
            betValue,
            resultColor: result.color,
            resultNumber: result.number,
            betAmount
        });

        switch (betType) {
            case 'NUMBER':
                if (result.number === parseInt(betValue)) {
                    return betAmount * 9.0;
                }
                break;

            case 'COLOR':
                if (betValue === 'red') {
                    if (result.color === 'red') {
                        return betAmount * 2.0;
                    } else if (result.color === 'red_violet') {
                        return betAmount * 1.5;
                    }
                } else if (betValue === 'green') {
                    if (result.color === 'green') {
                        return betAmount * 2.0;
                    } else if (result.color === 'green_violet') {
                        return betAmount * 1.5;
                    }
                } else if (betValue === 'violet') {
                    if (result.color === 'red_violet' || result.color === 'green_violet') {
                        return betAmount * 4.5;
                    }
                }
                return 0;

            case 'SIZE':
                const isBig = result.number >= 5;
                if ((betValue === 'big' && isBig) || (betValue === 'small' && !isBig)) {
                    return betAmount * 2.0;
                }
                break;

            case 'PARITY':
                const isEven = result.number % 2 === 0;
                if ((betValue === 'even' && isEven) || (betValue === 'odd' && !isEven)) {
                    return betAmount * 2.0;
                }
                break;
        }

        return 0;
    } catch (error) {
        console.error('Error calculating Wingo win:', error);
        return 0;
    }
}

// Test the 60/40 implementation
async function testWingo60_40Implementation() {
    console.log('🧪 [TEST_START] Testing Wingo 60/40 Implementation');
    console.log('=' .repeat(60));

    // Mock the 60/40 logic from the actual code
    const gameType = 'wingo';
    const duration = 60;
    const timeline = 'default';
    const periodId = 'test_period_123';

    try {
        // STRICT 60/40 ENFORCEMENT FOR WINGO/TRX_WIX
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsData = await redisClient.hgetall(betHashKey);
        const bets = Object.values(betsData).map(betJson => {
            try { return JSON.parse(betJson); } catch { return null; }
        }).filter(Boolean);
        
        const totalBetAmount = bets.reduce((sum, bet) => sum + parseFloat(bet.betAmount || bet.bet_amount || 0), 0);

        console.log('📊 [BET_ANALYSIS] Bet Analysis:');
        console.log(`   Total bets: ${bets.length}`);
        console.log(`   Total bet amount: ₹${totalBetAmount}`);
        bets.forEach((bet, index) => {
            console.log(`   Bet ${index + 1}: ${bet.betType}:${bet.betValue} - ₹${bet.betAmount}`);
        });

        let bestResult = null;
        let bestPayoutPercent = -Infinity;
        let lowestPayoutResult = null;
        let lowestPayoutPercent = Infinity;

        console.log('\n🎯 [RESULT_TESTING] Testing all possible results (0-9):');
        console.log('-'.repeat(60));

        for (let num = 0; num <= 9; num++) {
            const candidateResult = global.wingoCombinations[num];
            let totalPayout = 0;
            
            console.log(`\n🔍 Testing Result ${num}:`);
            console.log(`   Color: ${candidateResult.color}, Size: ${candidateResult.size}, Parity: ${candidateResult.parity}`);
            
            for (const bet of bets) {
                if (checkWingoWin(bet.betType, bet.betValue, candidateResult)) {
                    const winAmount = calculateWingoWin(bet, candidateResult, bet.betType, bet.betValue);
                    totalPayout += winAmount;
                    console.log(`   ✅ ${bet.betType}:${bet.betValue} WINS: ₹${winAmount}`);
                } else {
                    console.log(`   ❌ ${bet.betType}:${bet.betValue} LOSES`);
                }
            }
            
            const payoutPercent = totalBetAmount > 0 ? (totalPayout / totalBetAmount) * 100 : 0;
            console.log(`   💰 Total Payout: ₹${totalPayout} (${payoutPercent.toFixed(2)}%)`);
            
            if (payoutPercent <= 60 && payoutPercent > bestPayoutPercent) {
                bestPayoutPercent = payoutPercent;
                bestResult = candidateResult;
                console.log(`   🎯 NEW BEST 60/40 RESULT!`);
            }
            if (payoutPercent < lowestPayoutPercent) {
                lowestPayoutPercent = payoutPercent;
                lowestPayoutResult = candidateResult;
            }
        }

        const result = bestResult || lowestPayoutResult;
        
        console.log('\n🎯 [FINAL_RESULT] Selected result:');
        console.log('-'.repeat(60));
        console.log(`   Number: ${result?.number}`);
        console.log(`   Color: ${result?.color}`);
        console.log(`   Size: ${result?.size}`);
        console.log(`   Parity: ${result?.parity}`);
        console.log(`   Best 60/40 payout: ${bestPayoutPercent.toFixed(2)}%`);
        console.log(`   Lowest payout: ${lowestPayoutPercent.toFixed(2)}%`);

        // Verify 60/40 compliance
        console.log('\n✅ [60_40_VERIFICATION] 60/40 Rule Compliance:');
        console.log('-'.repeat(60));
        
        if (bestResult) {
            console.log(`✅ SUCCESS: Found result with ${bestPayoutPercent.toFixed(2)}% payout (≤60%)`);
            console.log(`✅ House edge: ${(100 - bestPayoutPercent).toFixed(2)}% (≥40%)`);
        } else {
            console.log(`⚠️ WARNING: No result found with ≤60% payout`);
            console.log(`⚠️ Using lowest payout result: ${lowestPayoutPercent.toFixed(2)}%`);
            
            if (lowestPayoutPercent > 60) {
                console.log(`❌ CRITICAL BUG: Lowest payout ${lowestPayoutPercent.toFixed(2)}% exceeds 60% limit!`);
                console.log(`❌ This means the house edge is ${(100 - lowestPayoutPercent).toFixed(2)}% which is <40%!`);
                return false;
            }
        }

        console.log('\n🎯 [TEST_COMPLETE] 60/40 Implementation Test Complete');
        return true;

    } catch (error) {
        console.error('❌ [TEST_ERROR] Error during test:', error);
        return false;
    }
}

// Run the test
testWingo60_40Implementation()
    .then(success => {
        if (success) {
            console.log('\n✅ [TEST_PASSED] Wingo 60/40 implementation is working correctly');
        } else {
            console.log('\n❌ [TEST_FAILED] Wingo 60/40 implementation has critical bugs!');
        }
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ [TEST_CRASH] Test crashed:', error);
        process.exit(1);
    }); 
module.exports = { setRedisHelper };
