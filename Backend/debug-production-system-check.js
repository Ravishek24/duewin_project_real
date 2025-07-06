const { getSequelizeInstance, initializeDatabase } = require('./config/db');
const Redis = require('ioredis');

// Connect to Redis
const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
});

async function checkProductionSystem() {
    console.log('🔍 CHECKING PRODUCTION SYSTEM');
    console.log('=====================================');
    
    let sequelize = null;
    
    try {
        // Initialize database connection
        await initializeDatabase();
        sequelize = await getSequelizeInstance();
        // Check the recent periods
        const periods = ['20250706000002004', '20250706000002003'];
        
        for (const periodId of periods) {
            console.log(`\n📊 Analyzing Period: ${periodId}`);
            console.log('===============================');
            
            // 1. First check what columns exist in the table
            const [tableInfo] = await sequelize.query(`DESCRIBE bet_record_wingos`);
            console.log('📋 Table Structure:', tableInfo.map(col => col.Field));
            
            // 2. Check bet records format (using actual column names)
            const [betRecords] = await sequelize.query(`
                SELECT bet_type, user_id, bet_amount, status, win_amount, created_at
                FROM bet_record_wingos 
                WHERE bet_number = :periodId
                ORDER BY created_at ASC
            `, {
                replacements: { periodId }
            });
            
            console.log('📋 Bet Records:', betRecords);
            
            // 2. Check result table structure first
            const [resultTableInfo] = await sequelize.query(`DESCRIBE bet_result_wingos`);
            console.log('🎯 Result Table Structure:', resultTableInfo.map(col => col.Field));
            
            // 3. Check result record (using actual column names)
            const [resultRecords] = await sequelize.query(`
                SELECT result_of_number, result_of_color, result_of_size, created_at
                FROM bet_result_wingos 
                WHERE bet_number = :periodId
            `, {
                replacements: { periodId }
            });
            
            console.log('🎯 Result Records:', resultRecords);
            
            // 3. Check Redis exposure data
            const exposureKey = `exposure:wingo:30:default:${periodId}`;
            const exposureData = await redisClient.hgetall(exposureKey);
            console.log('💰 Exposure Data:', exposureData);
            
            // 4. Check bet hash data
            const betHashKey = `bets:wingo:30:default:${periodId}`;
            const betHashData = await redisClient.hgetall(betHashKey);
            console.log('📊 Bet Hash Data:', betHashData);
            
            // 5. Analyze the problem
            if (betRecords.length > 0) {
                const bet = betRecords[0];
                const result = resultRecords[0];
                
                console.log('\n🔍 ANALYSIS:');
                console.log('=====================');
                const [betType, betValue] = bet.bet_type.split(':');
                console.log('Bet format:', `${betType}:${betValue}`);
                console.log('Result:', `number=${result.result_of_number}, color=${result.result_of_color}, size=${result.result_of_size}`);
                
                // Analyze the win/loss logic
                let expectedOutcome = 'UNKNOWN';
                if (betType === 'COLOR') {
                    if (betValue === 'violet') {
                        // Violet wins on numbers 0 and 5 (red_violet and green_violet)
                        if (result.result_of_color === 'red_violet' || result.result_of_color === 'green_violet') {
                            expectedOutcome = 'WIN';
                        } else {
                            expectedOutcome = 'LOSE';
                        }
                    } else if (betValue === 'red') {
                        if (result.result_of_color === 'red' || result.result_of_color === 'red_violet') {
                            expectedOutcome = 'WIN';
                        } else {
                            expectedOutcome = 'LOSE';
                        }
                    } else if (betValue === 'green') {
                        if (result.result_of_color === 'green' || result.result_of_color === 'green_violet') {
                            expectedOutcome = 'WIN';
                        } else {
                            expectedOutcome = 'LOSE';
                        }
                    }
                }
                
                console.log('Expected outcome:', expectedOutcome);
                console.log('Actual outcome:', bet.status.toUpperCase(), 'with win_amount:', bet.win_amount);
                
                // Check for bugs
                if (expectedOutcome !== bet.status.toUpperCase()) {
                    console.log('🚨 BUG DETECTED! Expected', expectedOutcome, 'but got', bet.status.toUpperCase());
                } else {
                    console.log('✅ Win/loss logic is correct');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await redisClient.quit();
        if (sequelize) {
            await sequelize.close();
        }
    }
}

checkProductionSystem(); 