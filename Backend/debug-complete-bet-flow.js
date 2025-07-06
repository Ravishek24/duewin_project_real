// Complete Bet Flow Test Script
// Tests the entire process from bet placement to win/loss determination

const path = require('path');

// Mock Redis client
const mockRedisClient = {
    data: {},
    hgetall: async function(key) {
        return this.data[key] || {};
    },
    hincrby: async function(key, field, value) {
        if (!this.data[key]) this.data[key] = {};
        this.data[key][field] = (parseInt(this.data[key][field] || 0) + value).toString();
        return parseInt(this.data[key][field]);
    },
    expire: async function(key, seconds) {
        return true;
    },
    del: async function(key) {
        delete this.data[key];
        return true;
    }
};

// Initialize game combinations
function initializeGameCombinations() {
    console.log('🎲 Initializing game combinations...');
    
    const getColorForNumber = (number) => {
        const colorMap = {
            0: 'red_violet', 1: 'green', 2: 'red', 3: 'green', 4: 'red',
            5: 'green_violet', 6: 'red', 7: 'green', 8: 'red', 9: 'green'
        };
        return colorMap[number] || 'unknown';
    };
    
    global.wingoCombinations = {};
    for (let i = 0; i <= 9; i++) {
        const color = getColorForNumber(i);
        const size = i >= 5 ? 'Big' : 'Small';
        const parity = i % 2 === 0 ? 'even' : 'odd';
        
        global.wingoCombinations[i] = {
            number: i, color: color, size: size, parity: parity,
            winning_conditions: {
                exact: [`NUMBER:${i}`], color: [`COLOR:${color}`],
                size: [`SIZE:${size.toLowerCase()}`], parity: [`PARITY:${parity}`]
            }
        };
    }
    
    console.log('✅ Game combinations initialized');
}

// 1. Simulate bet processing (simplified version)
async function simulateProcessBet(betData) {
    console.log('\n📝 [STEP 1] PROCESS BET');
    console.log('==========================================');
    console.log('💰 Processing bet:', betData);
    
    // Calculate tax (2% platform fee)
    const grossAmount = parseFloat(betData.betAmount);
    const platformFee = grossAmount * 0.02;
    const netAmount = grossAmount - platformFee;
    
    const processedBet = {
        ...betData,
        grossBetAmount: grossAmount,
        platformFee: platformFee,
        netBetAmount: netAmount,
        amount_after_tax: netAmount,
        wallet_balance_before: 5000.00
    };
    
    console.log('✅ Bet processed:', {
        grossAmount: grossAmount,
        platformFee: platformFee,
        netAmount: netAmount
    });
    
    return processedBet;
}

// 2. Simulate exposure calculation
async function simulateUpdateBetExposure(gameType, duration, periodId, bet, timeline = 'default') {
    console.log('\n📊 [STEP 2] UPDATE BET EXPOSURE');
    console.log('==========================================');
    
    const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
    console.log('🔑 Exposure key:', exposureKey);
    
    // Calculate exposure (potential payout)
    const odds = 2.0; // COLOR bet odds
    const exposure = Math.round(bet.netBetAmount * odds * 100); // Convert to cents
    
    console.log('💰 Exposure calculation:', {
        netBetAmount: bet.netBetAmount,
        odds: odds,
        exposure: exposure,
        exposureInRupees: exposure / 100
    });
    
    // Update exposure based on bet type
    const [betType, betValue] = bet.bet_type.split(':');
    
    if (betType === 'COLOR') {
        console.log('🎨 Processing COLOR bet for value:', betValue);
        
        // Update all matching numbers
        const updatedNumbers = [];
        for (let num = 0; num <= 9; num++) {
            const combo = global.wingoCombinations[num];
            
            // Check if this number matches the bet
            let matches = false;
            if (betValue === 'red') {
                matches = combo.color === 'red' || combo.color === 'red_violet';
            } else if (betValue === 'green') {
                matches = combo.color === 'green' || combo.color === 'green_violet';
            } else {
                matches = combo.color === betValue;
            }
            
            if (matches) {
                await mockRedisClient.hincrby(exposureKey, `number:${num}`, exposure);
                updatedNumbers.push(num);
                console.log(`📊 Updated exposure for number ${num}: +${exposure} cents`);
            }
        }
        
        console.log('✅ Updated exposure for numbers:', updatedNumbers);
    }
    
    // Show current exposures
    const currentExposures = await mockRedisClient.hgetall(exposureKey);
    console.log('💾 Current exposures (in cents):', currentExposures);
    
    return { exposureKey, exposure, currentExposures };
}

// 3. Simulate user count check
async function simulateGetUniqueUserCount(gameType, duration, periodId, timeline = 'default') {
    console.log('\n👥 [STEP 3] CHECK USER COUNT');
    console.log('==========================================');
    
    const userCount = 1; // Single user for our test
    const threshold = 100; // ENHANCED_USER_THRESHOLD
    const shouldUseProtection = userCount < threshold;
    
    console.log('📊 User count analysis:', {
        uniqueUserCount: userCount,
        threshold: threshold,
        shouldUseProtection: shouldUseProtection
    });
    
    return { userCount, threshold, shouldUseProtection };
}

// 4. Simulate result calculation
async function simulateCalculateResult(gameType, duration, periodId, timeline, exposures, userCountInfo) {
    console.log('\n🎲 [STEP 4] CALCULATE RESULT');
    console.log('==========================================');
    
    if (userCountInfo.shouldUseProtection) {
        console.log('🛡️ Protection mode: ACTIVE (insufficient users)');
        
        // Find numbers with zero exposure
        const zeroExposureNumbers = [];
        for (let num = 0; num <= 9; num++) {
            const exposure = parseInt(exposures.currentExposures[`number:${num}`] || 0);
            if (exposure === 0) {
                zeroExposureNumbers.push(num);
            }
        }
        
        console.log('🔍 Zero exposure numbers:', zeroExposureNumbers);
        
        if (zeroExposureNumbers.length > 0) {
            const selectedNumber = zeroExposureNumbers[Math.floor(Math.random() * zeroExposureNumbers.length)];
            const combo = global.wingoCombinations[selectedNumber];
            
            console.log('🛡️ Protection selected:', {
                number: selectedNumber,
                color: combo.color,
                reason: 'ZERO_EXPOSURE'
            });
            
            return combo;
        }
    }
    
    console.log('🎯 Normal mode: selecting random result');
    const randomNumber = Math.floor(Math.random() * 10);
    return global.wingoCombinations[randomNumber];
}

// 5. Simulate win checking
function simulateCheckBetWin(bet, result, gameType) {
    console.log('\n🎯 [STEP 5] CHECK BET WIN');
    console.log('==========================================');
    
    console.log('🔍 Checking bet win:', {
        betType: bet.bet_type,
        result: {
            number: result.number,
            color: result.color,
            size: result.size
        }
    });
    
    const [betType, betValue] = bet.bet_type.split(':');
    
    if (gameType.toLowerCase() === 'wingo') {
        const wingoCombo = global.wingoCombinations[result.number];
        if (!wingoCombo) {
            console.log('❌ No combination found for result number');
            return false;
        }
        
        console.log('📋 Using combination:', wingoCombo);
        
        // Check win condition
        let isWinner = false;
        
        switch (betType) {
            case 'COLOR':
                if (betValue === 'red') {
                    isWinner = wingoCombo.color === 'red' || wingoCombo.color === 'red_violet';
                } else if (betValue === 'green') {
                    isWinner = wingoCombo.color === 'green' || wingoCombo.color === 'green_violet';
                } else {
                    isWinner = wingoCombo.color === betValue;
                }
                break;
            case 'NUMBER':
                isWinner = wingoCombo.number === parseInt(betValue);
                break;
            case 'SIZE':
                isWinner = wingoCombo.size.toLowerCase() === betValue.toLowerCase();
                break;
            case 'PARITY':
                isWinner = wingoCombo.parity === betValue;
                break;
        }
        
        console.log('🎯 Win check result:', {
            betType: betType,
            betValue: betValue,
            resultColor: wingoCombo.color,
            isWinner: isWinner
        });
        
        return isWinner;
    }
    
    return false;
}

// 6. Simulate win processing
function simulateProcessWinning(bet, result, isWinner) {
    console.log('\n💰 [STEP 6] PROCESS WINNING');
    console.log('==========================================');
    
    if (isWinner) {
        const odds = 2.0; // COLOR bet odds
        const winnings = bet.amount_after_tax * odds;
        
        console.log('🎉 BET WON!');
        console.log('💰 Winnings calculation:', {
            amountAfterTax: bet.amount_after_tax,
            odds: odds,
            winnings: winnings,
            newBalance: bet.wallet_balance_before + winnings
        });
        
        return {
            status: 'won',
            winnings: winnings,
            newBalance: bet.wallet_balance_before + winnings
        };
    } else {
        console.log('❌ BET LOST');
        console.log('💸 Loss processing:', {
            amountLost: bet.grossBetAmount,
            newBalance: bet.wallet_balance_before // No change as amount was already deducted
        });
        
        return {
            status: 'lost',
            winnings: 0,
            newBalance: bet.wallet_balance_before
        };
    }
}

// Main test function
async function testCompleteBetFlow() {
    try {
        console.log('🚀 COMPLETE BET FLOW TEST');
        console.log('==========================================');
        console.log('🎯 Testing the scenario: USER BETS RED, RESULT IS GREEN');
        console.log('');
        
        // Initialize
        initializeGameCombinations();
        
        // Test data
        const testBet = {
            user_id: 13,
            bet_type: 'COLOR:red',
            betAmount: 100,
            period_id: '20250706000001881'
        };
        
        const gameType = 'wingo';
        const duration = 30;
        const timeline = 'default';
        
        // Step 1: Process bet
        const processedBet = await simulateProcessBet(testBet);
        
        // Step 2: Update exposure
        const exposureInfo = await simulateUpdateBetExposure(
            gameType, duration, testBet.period_id, processedBet, timeline
        );
        
        // Step 3: Check user count
        const userCountInfo = await simulateGetUniqueUserCount(
            gameType, duration, testBet.period_id, timeline
        );
        
        // Step 4: Calculate result
        const result = await simulateCalculateResult(
            gameType, duration, testBet.period_id, timeline, exposureInfo, userCountInfo
        );
        
        // Step 5: Check if bet wins
        const isWinner = simulateCheckBetWin(processedBet, result, gameType);
        
        // Step 6: Process winning/losing
        const finalResult = simulateProcessWinning(processedBet, result, isWinner);
        
        // Final analysis
        console.log('\n📊 [FINAL ANALYSIS]');
        console.log('==========================================');
        console.log('🎯 Test Summary:');
        console.log('   User bet: COLOR:red (100₹)');
        console.log(`   Result: Number ${result.number} (${result.color})`);
        console.log(`   Expected: User should ${userCountInfo.shouldUseProtection ? 'LOSE (protection active)' : 'WIN/LOSE (random)'}`);
        console.log(`   Actual: User ${finalResult.status.toUpperCase()} (${finalResult.winnings}₹)`);
        
        if (userCountInfo.shouldUseProtection) {
            if (processedBet.bet_type === 'COLOR:red' && (result.color === 'green' || result.color === 'green_violet')) {
                if (finalResult.status === 'lost') {
                    console.log('✅ CORRECT: User bet RED, result is GREEN, user LOST');
                } else {
                    console.log('❌ BUG FOUND: User bet RED, result is GREEN, but user WON!');
                }
            } else if (processedBet.bet_type === 'COLOR:red' && (result.color === 'red' || result.color === 'red_violet')) {
                if (finalResult.status === 'won') {
                    console.log('⚠️ UNEXPECTED: Protection should have prevented RED result for RED bet');
                } else {
                    console.log('❌ WEIRD: User bet RED, result is RED, but user LOST!');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testCompleteBetFlow().then(() => {
    console.log('\n✅ Complete bet flow test finished');
}).catch(error => {
    console.error('❌ Test error:', error);
}); 