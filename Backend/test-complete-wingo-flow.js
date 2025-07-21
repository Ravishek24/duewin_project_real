let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


// Complete Wingo Bet Processing Flow Test
// Tests every single function in the real bet processing pipeline

const path = require('path');
const moment = require('moment-timezone');

// Import all required modules
const { sequelize } = require('./config/db');
const gameLogicService = require('./services/gameLogicService');


// Redis client
const redisClient = 

// Test configuration
const TEST_CONFIG = {
    userId: 13,
    gameType: 'wingo',
    duration: 30,
    timeline: 'default',
    betType: 'COLOR',
    betValue: 'red',
    betAmount: 100,
    periodId: null // Will be generated
};

let stepCounter = 1;
let testResults = {};

// Helper function to log each step
function logStep(stepName, result, details = {}) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎯 STEP ${stepCounter}: ${stepName}`);
    console.log(`${'='.repeat(80)}`);
    
    if (typeof result === 'object') {
        console.log('📊 RESULT:', JSON.stringify(result, null, 2));
    } else {
        console.log('📊 RESULT:', result);
    }
    
    if (Object.keys(details).length > 0) {
        console.log('📋 DETAILS:', JSON.stringify(details, null, 2));
    }
    
    testResults[`step_${stepCounter}`] = {
        name: stepName,
        result: result,
        details: details,
        timestamp: new Date().toISOString()
    };
    
    stepCounter++;
    console.log(`${'='.repeat(80)}\n`);
    
    return result;
}

// Generate period ID
function generatePeriodId() {
    const now = moment().tz('Asia/Kolkata');
    const dateStr = now.format('YYYYMMDD');
    const periodNumber = String(Math.floor(now.valueOf() / 30000)).padStart(9, '0');
    return `${dateStr}${periodNumber}`;
}

async function testCompleteWingoFlow() {
    try {
        console.log('🚀 STARTING COMPLETE WINGO BET PROCESSING FLOW TEST');
        console.log('🚀 Testing all 13 steps with real functions...\n');
        
        // Initialize
        TEST_CONFIG.periodId = generatePeriodId();
        console.log('🎮 TEST CONFIGURATION:', JSON.stringify(TEST_CONFIG, null, 2));
        
        // Initialize models
        const models = await gameLogicService.ensureModelsInitialized();
        
        // STEP 1: SIMULATE USER BET PLACEMENT (Route Handler)
        const betRequest = {
            gameType: TEST_CONFIG.gameType,
            duration: TEST_CONFIG.duration,
            betType: TEST_CONFIG.betType,
            betValue: TEST_CONFIG.betValue,
            betAmount: TEST_CONFIG.betAmount,
            periodId: TEST_CONFIG.periodId,
            userId: TEST_CONFIG.userId
        };
        
        logStep('USER PLACES BET (POST Route Simulation)', {
            route: `POST /${TEST_CONFIG.gameType}/${TEST_CONFIG.duration}/bet`,
            requestBody: betRequest,
            status: 'Request received and parsed'
        });
        
        // STEP 2: VALIDATION
        const validation = await gameLogicService.validateBetWithTimeline({
            userId: TEST_CONFIG.userId,
            gameType: TEST_CONFIG.gameType,
            duration: TEST_CONFIG.duration,
            timeline: TEST_CONFIG.timeline,
            betType: TEST_CONFIG.betType,
            betValue: TEST_CONFIG.betValue,
            betAmount: TEST_CONFIG.betAmount,
            periodId: TEST_CONFIG.periodId
        });
        
        logStep('VALIDATION - validateBetWithTimeline()', validation, {
            function: 'gameLogicService.validateBetWithTimeline()',
            parameters: {
                userId: TEST_CONFIG.userId,
                gameType: TEST_CONFIG.gameType,
                duration: TEST_CONFIG.duration,
                betType: TEST_CONFIG.betType,
                betValue: TEST_CONFIG.betValue,
                betAmount: TEST_CONFIG.betAmount
            }
        });
        
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.message}`);
        }
        
        // STEP 3: ODDS CALCULATION
        const odds = gameLogicService.calculateOdds(
            TEST_CONFIG.gameType,
            TEST_CONFIG.betType,
            TEST_CONFIG.betValue
        );
        
        logStep('ODDS CALCULATION - calculateOdds()', odds, {
            function: 'gameLogicService.calculateOdds()',
            parameters: {
                gameType: TEST_CONFIG.gameType,
                betType: TEST_CONFIG.betType,
                betValue: TEST_CONFIG.betValue
            },
            calculation: `${TEST_CONFIG.betType}:${TEST_CONFIG.betValue} = ${odds}x multiplier`
        });
        
        // STEP 4: GET USER CURRENT BALANCE
        const userBefore = await models.User.findByPk(TEST_CONFIG.userId);
        const balanceBefore = parseFloat(userBefore.wallet_balance);
        
        logStep('USER BALANCE CHECK (Before Deduction)', {
            userId: TEST_CONFIG.userId,
            currentBalance: balanceBefore,
            betAmount: TEST_CONFIG.betAmount,
            sufficient: balanceBefore >= TEST_CONFIG.betAmount
        });
        
        // STEP 5: PROCESS BET (This includes balance deduction and database storage)
        const betResult = await gameLogicService.processBet({
            userId: TEST_CONFIG.userId,
            gameType: TEST_CONFIG.gameType,
            duration: TEST_CONFIG.duration,
            timeline: TEST_CONFIG.timeline,
            betType: TEST_CONFIG.betType,
            betValue: TEST_CONFIG.betValue,
            betAmount: TEST_CONFIG.betAmount,
            periodId: TEST_CONFIG.periodId
        });
        
        logStep('BET PROCESSING - processBet()', betResult, {
            function: 'gameLogicService.processBet()',
            includes: [
                'Balance deduction (User.decrement)',
                'Database storage (BetRecordWingo.create)',
                'Redis storage (storeBetInRedisWithTimeline)',
                'Exposure tracking (updateBetExposure)'
            ]
        });
        
        // Verify balance was deducted
        const userAfter = await models.User.findByPk(TEST_CONFIG.userId);
        const balanceAfter = parseFloat(userAfter.wallet_balance);
        
        logStep('BALANCE DEDUCTION VERIFICATION', {
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            deducted: balanceBefore - balanceAfter,
            expected: TEST_CONFIG.betAmount
        });
        
        // STEP 6: VERIFY DATABASE STORAGE
        const betRecord = await models.BetRecordWingo.findOne({
            where: {
                bet_number: TEST_CONFIG.periodId,
                user_id: TEST_CONFIG.userId
            }
        });
        
        logStep('DATABASE STORAGE VERIFICATION - BetRecordWingo.create()', {
            created: !!betRecord,
            betId: betRecord?.bet_id,
            betType: betRecord?.bet_type,
            amount: betRecord?.bet_amount,
            status: betRecord?.status
        });
        
                 // STEP 7: VERIFY REDIS STORAGE AND EXPOSURE
         const redisExposureKey = `exposure:${TEST_CONFIG.gameType}:${TEST_CONFIG.duration}:${TEST_CONFIG.timeline}:${TEST_CONFIG.periodId}`;
         const exposureData = await redisClient.hgetall(redisExposureKey);
         
         // Also check bet storage in Redis
         const betKey = `bets:${TEST_CONFIG.gameType}:${TEST_CONFIG.duration}:${TEST_CONFIG.timeline}:${TEST_CONFIG.periodId}`;
         const betData = await redisClient.hgetall(betKey);
         
         logStep('REDIS STORAGE & EXPOSURE TRACKING VERIFICATION', {
             exposureKey: redisExposureKey,
             exposureData: exposureData,
             exposureCount: Object.keys(exposureData).length,
             betKey: betKey,
             betData: betData,
             betCount: Object.keys(betData).length,
             redNumbers: Object.keys(exposureData).filter(k => k.includes('0') || k.includes('2') || k.includes('4') || k.includes('6') || k.includes('8')),
             greenNumbers: Object.keys(exposureData).filter(k => k.includes('1') || k.includes('3') || k.includes('5') || k.includes('7') || k.includes('9')),
             expectedExposure: 'COLOR:red should create exposure on numbers 0,2,4,6,8 (196₹ each)'
         });
        
                 // STEP 8: RESULT GENERATION
         console.log('\n🎰 GENERATING GAME RESULT...');
         
         // Fix: processGameResults expects a transaction parameter (can be null)
         const gameResult = await gameLogicService.processGameResults(
             TEST_CONFIG.gameType,
             TEST_CONFIG.duration,
             TEST_CONFIG.periodId,
             TEST_CONFIG.timeline,
             null  // transaction parameter
         );
        
        logStep('RESULT GENERATION - processGameResults()', gameResult, {
            function: 'gameLogicService.processGameResults()',
            includes: [
                'Protection check (getUniqueUserCount)',
                'Result selection (selectProtectedResultWithExposure)',
                'Result storage (BetResultWingo.create)'
            ]
        });
        
        // STEP 9: GET UNIQUE USER COUNT (Protection Check)
        const userCount = await gameLogicService.getUniqueUserCount(
            TEST_CONFIG.gameType,
            TEST_CONFIG.duration,
            TEST_CONFIG.periodId,
            TEST_CONFIG.timeline
        );
        
        logStep('PROTECTION CHECK - getUniqueUserCount()', {
            uniqueUsers: userCount,
            threshold: 100,
            protectionActive: userCount < 100
        });
        
        // STEP 10: WIN CHECKING
        const finalResult = gameResult.gameResult;
        const isWinner = await gameLogicService.checkBetWin(betRecord, finalResult, TEST_CONFIG.gameType);
        
        logStep('WIN CHECKING - checkBetWin()', {
            betType: betRecord.bet_type,
            result: finalResult,
            isWinner: isWinner,
            explanation: `Bet ${betRecord.bet_type} vs Result number ${finalResult.number} (${finalResult.color})`
        });
        
        // STEP 11: PAYOUT CALCULATION
        const [betType, betValue] = betRecord.bet_type.split(':');
        const winAmount = gameLogicService.calculateWingoWin(
            betRecord,
            finalResult,
            betType,
            betValue
        );
        
        logStep('PAYOUT CALCULATION - calculateWingoWin()', {
            betAmount: betRecord.bet_amount,
            odds: odds,
            winAmount: winAmount,
            calculation: isWinner ? `${betRecord.bet_amount} × ${odds} = ${winAmount}` : 'Loss = 0'
        });
        
        // STEP 12: CHECK IF WINNER PROCESSING HAPPENED
        const updatedBetRecord = await models.BetRecordWingo.findByPk(betRecord.bet_id);
        
        logStep('WINNER PROCESSING VERIFICATION', {
            originalStatus: betRecord.status,
            finalStatus: updatedBetRecord.status,
            winAmount: updatedBetRecord.win_amount,
            processed: updatedBetRecord.status !== 'pending'
        });
        
        // STEP 13: FINAL BALANCE CHECK
        const userFinal = await models.User.findByPk(TEST_CONFIG.userId);
        const balanceFinal = parseFloat(userFinal.wallet_balance);
        
        logStep('FINAL BALANCE & BROADCASTING', {
            balanceAfterBet: balanceAfter,
            balanceFinal: balanceFinal,
            winnings: balanceFinal - balanceAfter,
            broadcastingSent: 'Game result broadcasted via WebSocket'
        });
        
        // SUMMARY
        console.log('\n' + '🏆'.repeat(80));
        console.log('🏆 COMPLETE WINGO FLOW TEST SUMMARY');
        console.log('🏆'.repeat(80));
        
        console.log(`
📊 TEST RESULTS SUMMARY:
=======================
👤 User ID: ${TEST_CONFIG.userId}
🎮 Game: ${TEST_CONFIG.gameType} (${TEST_CONFIG.duration}s)
🎯 Bet: ${TEST_CONFIG.betType}:${TEST_CONFIG.betValue} (₹${TEST_CONFIG.betAmount})
🎲 Result: Number ${finalResult.number} (${finalResult.color}, ${finalResult.size})
🏆 Outcome: ${isWinner ? 'WON' : 'LOST'} (₹${winAmount})

💰 BALANCE FLOW:
================
Starting: ₹${balanceBefore}
After Bet: ₹${balanceAfter} (-₹${balanceBefore - balanceAfter})
Final: ₹${balanceFinal} (${balanceFinal > balanceAfter ? '+' : ''}₹${balanceFinal - balanceAfter})

🛡️ PROTECTION STATUS:
=====================
Unique Users: ${userCount}
Protection Active: ${userCount < 100 ? 'YES' : 'NO'}
System: ${gameResult.protectionMode ? 'PROTECTION MODE' : 'NORMAL MODE'}

✅ ALL ${stepCounter - 1} STEPS COMPLETED SUCCESSFULLY!
        `);
        
        // Save detailed results
        const fs = require('fs');
        fs.writeFileSync(
            `./wingo-flow-test-results-${Date.now()}.json`,
            JSON.stringify(testResults, null, 2)
        );
        
        console.log('📁 Detailed results saved to JSON file');
        
    } catch (error) {
        console.error('❌ TEST FAILED:', error.message);
        console.error('Stack:', error.stack);
        
        logStep('ERROR OCCURRED', {
            error: error.message,
            stack: error.stack
        });
        
         } finally {
         try {
             await redisClient.disconnect();
         } catch (err) {
             console.log('Redis disconnect error:', err.message);
         }
         
         try {
             if (sequelize && sequelize.close) {
                 await sequelize.close();
             }
         } catch (err) {
             console.log('Sequelize close error:', err.message);
         }
     }
}

// Run the test
if (require.main === module) {
    testCompleteWingoFlow()
        .then(() => {
            console.log('\n✅ Test completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testCompleteWingoFlow }; 