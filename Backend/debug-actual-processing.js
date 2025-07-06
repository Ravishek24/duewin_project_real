const mysql = require('mysql2/promise');
const config = require('./config/config.js');

// Get environment and database configuration
const env = process.env.NODE_ENV || 'development';
const dbConfigFromFile = config[env];

// Database connection
const dbConfig = {
    host: dbConfigFromFile.host,
    user: dbConfigFromFile.username,
    password: dbConfigFromFile.password,
    database: dbConfigFromFile.database,
    port: dbConfigFromFile.port
};

console.log('🔧 Database config loaded:', {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    port: dbConfig.port,
    hasPassword: !!dbConfig.password
});

// Color mapping function
const getColorForNumber = (number) => {
    const colorMap = {
        0: 'red_violet', 1: 'green', 2: 'red', 3: 'green', 4: 'red',
        5: 'green_violet', 6: 'red', 7: 'green', 8: 'red', 9: 'green'
    };
    return colorMap[number] || 'unknown';
};

// Initialize game combinations
function initializeGameCombinations() {
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
}

// Check win condition
function checkWinCondition(combination, betType, betValue) {
    switch (betType) {
        case 'COLOR':
            if (betValue === 'red') {
                return combination.color === 'red' || combination.color === 'red_violet';
            }
            if (betValue === 'green') {
                return combination.color === 'green' || combination.color === 'green_violet';
            }
            return combination.color === betValue;
        case 'NUMBER':
            return combination.number === parseInt(betValue);
        case 'SIZE':
            return combination.size.toLowerCase() === betValue.toLowerCase();
        case 'PARITY':
            return combination.parity === betValue;
        default:
            return false;
    }
}

// Check bet win
function checkBetWin(bet, result, gameType) {
    const [betType, betValue] = bet.bet_type.split(':');
    
    if (gameType.toLowerCase() === 'wingo') {
        const wingoCombo = global.wingoCombinations[result.number];
        if (!wingoCombo) return false;
        return checkWinCondition(wingoCombo, betType, betValue);
    }
    return false;
}

// Debug actual processing
async function debugActualProcessing() {
    let connection;
    
    try {
        console.log('🔍 [DEBUG] Starting actual processing investigation...');
        console.log('🔍 [DEBUG] ==========================================');
        
        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ [DEBUG] Connected to database');
        
        // Initialize combinations
        initializeGameCombinations();
        
        // Get the problematic period data
        const periodId = '20250706000001881';
        
        console.log('📋 [DEBUG] Investigating period:', periodId);
        console.log('');
        
        // Get bet records
        const [betRows] = await connection.execute(
            'SELECT * FROM bet_records_wingo WHERE bet_number = ?',
            [periodId]
        );
        
        console.log('💰 [DEBUG] Found bet records:', betRows.length);
        for (const bet of betRows) {
            console.log('   Bet:', {
                user_id: bet.user_id,
                bet_type: bet.bet_type,
                bet_amount: bet.bet_amount,
                status: bet.status,
                win_amount: bet.win_amount
            });
        }
        console.log('');
        
        // Get result record
        const [resultRows] = await connection.execute(
            'SELECT * FROM bet_results_wingo WHERE bet_number = ?',
            [periodId]
        );
        
        console.log('🎲 [DEBUG] Found result records:', resultRows.length);
        if (resultRows.length > 0) {
            const result = resultRows[0];
            console.log('   Result:', {
                number: result.result_of_number,
                color: result.result_of_color,
                size: result.result_of_size
            });
            
            console.log('');
            
            // Test each bet against the result
            for (const bet of betRows) {
                console.log(`🧪 [DEBUG] Testing bet from user ${bet.user_id}:`);
                console.log(`   Bet: ${bet.bet_type} (Amount: ${bet.bet_amount})`);
                console.log(`   Result: Number ${result.result_of_number} (${result.result_of_color})`);
                
                // Create result object
                const gameResult = {
                    number: result.result_of_number,
                    color: result.result_of_color,
                    size: result.result_of_size,
                    parity: result.result_of_number % 2 === 0 ? 'even' : 'odd'
                };
                
                // Test win condition
                const shouldWin = checkBetWin(bet, gameResult, 'wingo');
                const actualStatus = bet.status;
                const actualWinAmount = parseFloat(bet.win_amount || 0);
                
                console.log(`   Logic says: ${shouldWin ? 'WIN' : 'LOSE'}`);
                console.log(`   Database says: ${actualStatus.toUpperCase()} (${actualWinAmount}₹)`);
                
                if (shouldWin && actualStatus === 'won') {
                    console.log('   ✅ CORRECT: Logic and database match (WIN)');
                } else if (!shouldWin && actualStatus === 'lost') {
                    console.log('   ✅ CORRECT: Logic and database match (LOSE)');
                } else {
                    console.log('   ❌ BUG FOUND: Logic and database DO NOT match!');
                    console.log(`      Logic: ${shouldWin ? 'WIN' : 'LOSE'}`);
                    console.log(`      Database: ${actualStatus.toUpperCase()}`);
                    
                    // Detailed analysis
                    const [betType, betValue] = bet.bet_type.split(':');
                    console.log('   🔍 DETAILED ANALYSIS:');
                    console.log(`      Bet Type: ${betType}, Bet Value: ${betValue}`);
                    console.log(`      Result Number: ${result.result_of_number}`);
                    console.log(`      Result Color: ${result.result_of_color}`);
                    console.log(`      Expected Color for Number ${result.result_of_number}: ${getColorForNumber(result.result_of_number)}`);
                    
                    if (result.result_of_color !== getColorForNumber(result.result_of_number)) {
                        console.log('   🚨 POTENTIAL ISSUE: Result color doesn\'t match expected color for number!');
                    }
                }
                console.log('');
            }
        }
        
        console.log('🔍 [DEBUG] Investigation completed');
        console.log('🔍 [DEBUG] ==========================================');
        
    } catch (error) {
        console.error('❌ [DEBUG] Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the debug
debugActualProcessing().then(() => {
    console.log('✅ Debug completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
}); 