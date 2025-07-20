const { Sequelize } = require('sequelize');

async function testDatabaseExposure() {
    // Use the actual database configuration from your .env
    const sequelize = new Sequelize({
        username: 'admin',
        password: 'StrikeGame52504',
        database: 'strike',
        host: 'database-1.cluster-crqgo8mywtnt.ap-southeast-1.rds.amazonaws.com',
        port: 3306,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
    
    try {
        console.log('🔍 [TEST] Testing database exposure calculation...');
        
        // Test case: combination [8,7,8,5,7] = dice_value 87857, sum=35 (big+odd)
        const combination = await sequelize.query(`
            SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e, 
                   sum_value, sum_size, sum_parity, winning_conditions
            FROM game_combinations_5d 
            WHERE dice_value = 87857
        `, { type: Sequelize.QueryTypes.SELECT });
        
        if (combination.length === 0) {
            console.log('❌ [TEST] Combination not found in database');
            return;
        }
        
        const combo = combination[0];
        console.log('✅ [TEST] Found combination:', {
            dice_value: combo.dice_value,
            dice: [combo.dice_a, combo.dice_b, combo.dice_c, combo.dice_d, combo.dice_e],
            sum: combo.sum_value,
            sum_size: combo.sum_size,
            sum_parity: combo.sum_parity
        });
        
        // Parse winning conditions - handle both string and object formats
        let winningConditions;
        try {
            if (typeof combo.winning_conditions === 'string') {
                winningConditions = JSON.parse(combo.winning_conditions);
            } else {
                winningConditions = combo.winning_conditions;
            }
            console.log('📋 [TEST] Database winning conditions:', JSON.stringify(winningConditions, null, 2));
        } catch (parseError) {
            console.error('❌ [TEST] Error parsing winning conditions:', parseError);
            console.log('Raw winning_conditions:', combo.winning_conditions);
            console.log('Type:', typeof combo.winning_conditions);
            return;
        }
        
        // Simulate user's bets
        const userBets = {
            'bet:SUM_odd': 98,   // User bet on SUM_odd
            'bet:SUM_big': 98    // User bet on SUM_big
        };
        
        console.log('💰 [TEST] User bets:', userBets);
        
        // Test exposure calculation manually
        let totalExposure = 0;
        
        for (const [betKey, exposure] of Object.entries(userBets)) {
            const actualBetKey = betKey.replace('bet:', '');
            let wins = false;
            
            console.log(`🔍 [TEST] Checking bet: ${actualBetKey}`);
            
            // Check sum conditions
            if (actualBetKey === 'SUM_odd' && winningConditions.sum?.parity === 'SUM_PARITY:odd') {
                wins = true;
                console.log(`✅ [TEST] SUM_odd matches SUM_PARITY:odd`);
            } else if (actualBetKey === 'SUM_big' && winningConditions.sum?.size === 'SUM_SIZE:big') {
                wins = true;
                console.log(`✅ [TEST] SUM_big matches SUM_SIZE:big`);
            }
            
            if (wins) {
                totalExposure += parseFloat(exposure);
                console.log(`🎯 [TEST] Bet ${actualBetKey} = WIN (exposure: ${exposure})`);
            } else {
                console.log(`❌ [TEST] Bet ${actualBetKey} = LOSS`);
            }
        }
        
        console.log(`💰 [TEST] Total exposure for combination: ${totalExposure}`);
        
        // Test protection logic
        console.log('\n🛡️ [TEST] Testing protection logic...');
        
        // Find zero exposure combinations
        const zeroExposureCombos = await sequelize.query(`
            SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e, 
                   sum_value, sum_size, sum_parity
            FROM game_combinations_5d 
            WHERE sum_size != 'big' OR sum_parity != 'odd'
            LIMIT 5
        `, { type: Sequelize.QueryTypes.SELECT });
        
        console.log('🛡️ [TEST] Zero exposure combinations (sum != big+odd):');
        zeroExposureCombos.forEach((combo, i) => {
            console.log(`  ${i+1}. [${combo.dice_a},${combo.dice_b},${combo.dice_c},${combo.dice_d},${combo.dice_e}] = sum ${combo.sum_value} (${combo.sum_size}+${combo.sum_parity})`);
        });
        
    } catch (error) {
        console.error('❌ [TEST] Error:', error);
    } finally {
        await sequelize.close();
    }
}

testDatabaseExposure(); 