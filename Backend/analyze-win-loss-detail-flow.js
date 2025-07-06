const gameLogicService = require('./services/gameLogicService');

async function analyzeWinLossDetailFlow() {
    console.log('🎯 ANALYZING COMPLETE WIN/LOSS DETAIL FLOW');
    console.log('==========================================\n');
    
    try {
        // Initialize combinations
        await gameLogicService.initializeGameCombinations();
        
        console.log('📊 COMPLETE WIN/LOSS FLOW ANALYSIS:\n');
        
        // Step 1: Bet Placement Flow
        console.log('1️⃣ BET PLACEMENT FLOW:');
        console.log('   ├── User places bet via WebSocket');
        console.log('   ├── processWebSocketBet() called');
        console.log('   ├── gameLogicService.processBet() called');
        console.log('   ├── Bet stored in database (status: "pending")');
        console.log('   ├── Bet stored in Redis with exposure tracking');
        console.log('   └── User balance deducted');
        console.log('');
        
        // Step 2: Result Processing Flow
        console.log('2️⃣ RESULT PROCESSING FLOW:');
        console.log('   ├── Period ends');
        console.log('   ├── calculateResultWithVerification() called');
        console.log('   ├── selectProtectedResultWithExposure() called (if user count < 100)');
        console.log('   ├── Result selected (GREEN number for RED bet)');
        console.log('   ├── processGameResults() called');
        console.log('   └── processWinningBets() called');
        console.log('');
        
        // Step 3: Win/Loss Determination Flow
        console.log('3️⃣ WIN/LOSS DETERMINATION FLOW:');
        console.log('   ├── processWinningBets() queries database for all bets');
        console.log('   ├── For each bet: checkBetWin(bet, result, gameType) called');
        console.log('   ├── checkBetWin() parses bet.bet_type (e.g., "COLOR:red")');
        console.log('   ├── checkBetWin() gets result.number and finds wingoCombo');
        console.log('   ├── checkBetWin() calls checkWinCondition(wingoCombo, betType, betValue)');
        console.log('   ├── If WIN: Update bet status to "won", add winnings to user balance');
        console.log('   └── If LOSE: Update bet status to "lost", no winnings');
        console.log('');
        
        // Step 4: Critical Functions Analysis
        console.log('4️⃣ CRITICAL FUNCTIONS ANALYSIS:\n');
        
        // Test the exact flow with production data
        console.log('🧪 TESTING PRODUCTION SCENARIO:');
        console.log('   User 13 bets RED (₹100), Result is GREEN (Number 3)');
        console.log('');
        
        // Simulate the exact database bet record
        const productionBetRecord = {
            bet_id: 12345,
            user_id: 13,
            bet_number: '20250706000001881',
            bet_type: 'COLOR:red',
            bet_amount: 100,
            tax_amount: 2,
            amount_after_tax: 98,
            odds: 2,
            status: 'pending',
            wallet_balance_before: 5000,
            wallet_balance_after: 4900
        };
        
        const productionResult = {
            number: 3,
            color: 'green',
            size: 'Small',
            parity: 'odd'
        };
        
        console.log('📊 Production Bet Record:');
        console.log(JSON.stringify(productionBetRecord, null, 2));
        console.log('');
        
        console.log('📊 Production Result:');
        console.log(JSON.stringify(productionResult, null, 2));
        console.log('');
        
        // Test checkBetWin function
        console.log('🔍 Testing checkBetWin function:');
        const winResult = await gameLogicService.checkBetWin(productionBetRecord, productionResult, 'wingo');
        console.log(`   checkBetWin result: ${winResult}`);
        console.log(`   Expected: false (user should lose)`);
        console.log(`   Status: ${winResult === false ? '✅ CORRECT' : '❌ BUG FOUND!'}`);
        console.log('');
        
        // Test checkWinCondition function directly
        console.log('🔍 Testing checkWinCondition function:');
        const wingoCombo = global.wingoCombinations[3]; // Number 3
        console.log(`   Wingo combo for number 3:`, wingoCombo);
        
        // We need to access checkWinCondition directly
        console.log('   Note: checkWinCondition is not exported, but logic is:');
        console.log('   - RED bet wins on numbers: 0,2,4,6,8 (red/red_violet)');
        console.log('   - GREEN bet wins on numbers: 1,3,5,7,9 (green/green_violet)');
        console.log('   - Number 3 is GREEN, so RED bet should LOSE');
        console.log('');
        
        // Step 5: Database Update Flow
        console.log('5️⃣ DATABASE UPDATE FLOW:');
        if (winResult === false) {
            console.log('   ✅ If checkBetWin returns false:');
            console.log('   ├── bet.status = "lost"');
            console.log('   ├── bet.payout = 0');
            console.log('   ├── bet.win_amount = 0');
            console.log('   ├── bet.wallet_balance_after = bet.wallet_balance_before');
            console.log('   └── User balance unchanged');
        } else {
            console.log('   ❌ If checkBetWin returns true (BUG):');
            console.log('   ├── bet.status = "won"');
            console.log('   ├── bet.payout = 196 (98 × 2 odds)');
            console.log('   ├── bet.win_amount = 196');
            console.log('   ├── User balance increased by 196');
            console.log('   └── This would be the BUG!');
        }
        console.log('');
        
        // Step 6: Potential Bug Sources
        console.log('6️⃣ POTENTIAL BUG SOURCES:\n');
        
        if (winResult === false) {
            console.log('✅ Win/loss logic is CORRECT!');
            console.log('');
            console.log('🚨 The bug must be elsewhere:');
            console.log('');
            console.log('A) ADMIN MANUAL RESULT SETTING:');
            console.log('   - Admin manually sets results via different system');
            console.log('   - Admin overrides protection logic');
            console.log('   - Admin sets wrong win/loss status in database');
            console.log('');
            console.log('B) MULTIPLE PROCESSING SYSTEMS:');
            console.log('   - Different system processes results');
            console.log('   - Old/broken system still active');
            console.log('   - WebSocket vs REST API conflict');
            console.log('');
            console.log('C) DATABASE SYNC ISSUES:');
            console.log('   - Database records updated incorrectly');
            console.log('   - Transaction rollback issues');
            console.log('   - Race conditions between systems');
            console.log('');
            console.log('D) TIMING ISSUES:');
            console.log('   - Results processed before bets are fully stored');
            console.log('   - Exposure data not available when results calculated');
            console.log('   - Protection logic bypassed due to timing');
            console.log('');
        } else {
            console.log('❌ Win/loss logic has a BUG!');
            console.log('   This is the root cause of the issue.');
        }
        
        // Step 7: Recommended Investigation
        console.log('7️⃣ RECOMMENDED INVESTIGATION:\n');
        console.log('1. Check if admin manually sets results');
        console.log('2. Check database records for actual win/loss status');
        console.log('3. Check if multiple result processing systems exist');
        console.log('4. Check timing of result processing vs bet placement');
        console.log('5. Check if protection logic is actually called in production');
        console.log('');
        
        console.log('🎯 CONCLUSION:');
        if (winResult === false) {
            console.log('✅ The win/loss determination logic is working correctly.');
            console.log('🚨 The bug is in the result processing system or admin override.');
        } else {
            console.log('❌ The win/loss determination logic has a bug.');
            console.log('🔧 This needs to be fixed immediately.');
        }
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the analysis
analyzeWinLossDetailFlow().catch(console.error); 