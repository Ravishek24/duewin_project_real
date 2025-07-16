const redis = require('redis');
const { getSequelizeInstance } = require('./config/db');
const moment = require('moment-timezone');

// Initialize Redis client
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('✅ Redis connected for 5D monitoring'));

// Initialize Sequelize
let sequelize;

async function initializeMonitoring() {
    try {
        // Connect to Redis
        await redisClient.connect();
        console.log('✅ Redis connected for 5D monitoring');
        
        // Connect to database
        sequelize = await getSequelizeInstance();
        console.log('✅ Database connected for 5D monitoring');
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

// Get current period ID using the correct format
async function getCurrentPeriodId(gameType, duration) {
    try {
        const now = new Date();
        const istMoment = moment(now).tz('Asia/Kolkata');
        
        // Calculate time since 2 AM today
        let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
        
        // If current time is before 2 AM, use 2 AM of previous day
        if (istMoment.hour() < 2) {
            startOfPeriods.subtract(1, 'day');
        }
        
        // Calculate total seconds since period start
        const totalSeconds = istMoment.diff(startOfPeriods, 'seconds');
        
        // Calculate current period number (0-based)
        const currentPeriodNumber = Math.floor(totalSeconds / duration);
        
        // Generate period ID
        const dateStr = startOfPeriods.format('YYYYMMDD');
        const periodId = `${dateStr}${currentPeriodNumber.toString().padStart(9, '0')}`;
        
        return periodId;
    } catch (error) {
        console.error('Error getting current period ID:', error);
        throw error;
    }
}

// Enhanced 5D Bet Monitoring
async function monitor5DBets() {
    console.log('🎲 [5D_MONITOR] Starting comprehensive 5D bet monitoring...');
    console.log('🎲 [5D_MONITOR] Monitoring all 5D periods and protection logic...');
    console.log('='.repeat(80));

    // Monitor current active periods
    await monitorActivePeriods();
    
    // Monitor recent results
    await monitorRecentResults();
    
    // Monitor protection logic
    await monitorProtectionLogic();
    
    // Monitor exposure data
    await monitorExposureData();
    
    // Monitor bet distribution
    await monitorBetDistribution();
}

async function monitorActivePeriods() {
    console.log('\n📊 [5D_MONITOR] === ACTIVE PERIODS ANALYSIS ===');
    
    // First, let's check what Redis keys exist
    try {
        console.log('🔍 [5D_DEBUG] Scanning Redis for 5D keys...');
        const keys = await redisClient.keys('*5d*');
        console.log(`🔍 [5D_DEBUG] Found ${keys.length} 5D-related keys in Redis`);
        if (keys.length > 0) {
            console.log('🔍 [5D_DEBUG] Sample keys:', keys.slice(0, 10));
        }
        
        // Extract unique period IDs from the keys
        const periodIds = new Set();
        const periodData = {};
        
        for (const key of keys) {
            // Parse key format: bets:5d:60:default:20241201003 or exposure:5d:60:default:20241201003
            const match = key.match(/bets:5d:(\d+):default:(\d+)|exposure:5d:(\d+):default:(\d+)/);
            if (match) {
                const duration = match[1] || match[3];
                const periodId = match[2] || match[4];
                periodIds.add(periodId);
                
                if (!periodData[periodId]) {
                    periodData[periodId] = { durations: new Set() };
                }
                periodData[periodId].durations.add(parseInt(duration));
            }
        }
        
        console.log(`📊 [5D_PERIODS] Found ${periodIds.size} unique period IDs with data:`, Array.from(periodIds));
        
        // Monitor each period that has data
        for (const periodId of periodIds) {
            const durations = periodData[periodId].durations;
            console.log(`\n📊 [5D_PERIOD_ANALYSIS] Period: ${periodId}`);
            console.log(`📊 [5D_PERIOD_ANALYSIS] Durations with data:`, Array.from(durations));
            
            for (const duration of durations) {
                try {
                    const exposureKey = `exposure:5d:${duration}:default:${periodId}`;
                    const betHashKey = `bets:5d:${duration}:default:${periodId}`;
                    
                    console.log(`\n⏰ [5D_PERIOD] Duration: ${duration}s, Period: ${periodId}`);
                    
                    // Get exposure data
                    const exposures = await redisClient.hGetAll(exposureKey);
                    const bets = await redisClient.hGetAll(betHashKey);
                    
                    console.log(`📈 [5D_STATS] Total bets: ${Object.keys(bets).length}`);
                    console.log(`💰 [5D_STATS] Total exposure entries: ${Object.keys(exposures).length}`);
                    
                    if (Object.keys(bets).length > 0) {
                        const betDetails = Object.values(bets).map(betJson => {
                            try { return JSON.parse(betJson); } catch { return null; }
                        }).filter(Boolean);
                        
                        const uniqueUsers = [...new Set(betDetails.map(bet => bet.userId))];
                        const totalBetAmount = betDetails.reduce((sum, bet) => sum + parseFloat(bet.netBetAmount || 0), 0);
                        
                        console.log(`👥 [5D_USERS] Unique users: ${uniqueUsers.length}`);
                        console.log(`💵 [5D_AMOUNT] Total bet amount: ₹${totalBetAmount.toFixed(2)}`);
                        
                        // Analyze bet types
                        const betTypes = {};
                        betDetails.forEach(bet => {
                            const type = bet.betType || 'UNKNOWN';
                            betTypes[type] = (betTypes[type] || 0) + 1;
                        });
                        
                        console.log(`🎯 [5D_BET_TYPES] Bet type distribution:`, betTypes);
                        
                        // Check for protection conditions
                        const aBets = Object.keys(exposures).filter(key => 
                            key.startsWith('bet:POSITION:A_') && key !== 'bet:POSITION:A_0'
                        );
                        const hasA0Bet = Object.keys(exposures).some(key => key === 'bet:POSITION:A_0');
                        const hasA1to9Bets = aBets.some(bet => bet.match(/A_[1-9]/));
                        const shouldApplyProtection = hasA1to9Bets && !hasA0Bet;
                        
                        console.log(`🛡️ [5D_PROTECTION] Protection analysis:`);
                        console.log(`   - A_1-9 bets: ${aBets.filter(bet => bet.match(/A_[1-9]/)).length}`);
                        console.log(`   - A_0 bet: ${hasA0Bet ? 'YES' : 'NO'}`);
                        console.log(`   - Should apply protection: ${shouldApplyProtection ? 'YES' : 'NO'}`);
                        
                        if (shouldApplyProtection) {
                            console.log(`🚨 [5D_PROTECTION_ALERT] Protection should be applied!`);
                        }
                        
                        // Show detailed bet information
                        console.log(`📋 [5D_BET_DETAILS] Sample bets:`);
                        betDetails.slice(0, 3).forEach((bet, index) => {
                            console.log(`   ${index + 1}. User: ${bet.userId}, Type: ${bet.betType}, Value: ${bet.betValue}, Amount: ₹${bet.netBetAmount}`);
                        });
                        
                    } else {
                        console.log(`📭 [5D_EMPTY] No bets in this period`);
                    }
                    
                } catch (error) {
                    console.error(`❌ [5D_ERROR] Error monitoring period ${periodId} duration ${duration}s:`, error.message);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ [5D_ERROR] Error scanning Redis keys:', error.message);
    }
}

async function monitorRecentResults() {
    console.log('\n📊 [5D_MONITOR] === RECENT RESULTS ANALYSIS ===');
    
    try {
        // Get recent 5D results from database - using correct column names
        const recentResults = await sequelize.query(`
            SELECT 
                bet_id, bet_number,
                result_a, result_b, result_c, result_d, result_e,
                total_sum,
                created_at
            FROM bet_result_5ds 
            ORDER BY created_at DESC 
            LIMIT 10
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log(`📈 [5D_RESULTS] Found ${recentResults.length} recent results`);
        
        for (const result of recentResults) {
            console.log(`\n🎲 [5D_RESULT] Period: ${result.bet_number}`);
            console.log(`   Result: A=${result.result_a}, B=${result.result_b}, C=${result.result_c}, D=${result.result_d}, E=${result.result_e}`);
            console.log(`   Sum: ${result.total_sum}`);
            console.log(`   Created: ${result.created_at}`);
            
            // Note: We can't check protection for historical results without period_id
            // This would require additional data or different approach
        }
        
    } catch (error) {
        console.error(`❌ [5D_ERROR] Error monitoring recent results:`, error.message);
    }
}

async function monitorProtectionLogic() {
    console.log('\n📊 [5D_MONITOR] === PROTECTION LOGIC ANALYSIS ===');
    
    try {
        // Get all 5D keys to find periods with data
        const keys = await redisClient.keys('*5d*');
        const periodIds = new Set();
        
        for (const key of keys) {
            const match = key.match(/bets:5d:(\d+):default:(\d+)|exposure:5d:(\d+):default:(\d+)/);
            if (match) {
                const periodId = match[2] || match[4];
                periodIds.add(periodId);
            }
        }
        
        for (const periodId of periodIds) {
            const durations = [30, 60, 180, 300, 600];
            
            for (const duration of durations) {
                try {
                    const exposureKey = `exposure:5d:${duration}:default:${periodId}`;
                    
                    const exposures = await redisClient.hGetAll(exposureKey);
                    
                    if (Object.keys(exposures).length > 0) {
                        console.log(`\n🔍 [5D_PROTECTION_ANALYSIS] Duration: ${duration}s, Period: ${periodId}`);
                        
                        // Analyze position bets
                        const positionBets = {};
                        for (const [betKey, exposure] of Object.entries(exposures)) {
                            if (betKey.startsWith('bet:POSITION:')) {
                                const match = betKey.match(/POSITION:([A-E])_(\d)/);
                                if (match) {
                                    const [_, position, value] = match;
                                    if (!positionBets[position]) positionBets[position] = [];
                                    positionBets[position].push({ value: parseInt(value), exposure: exposure });
                                }
                            }
                        }
                        
                        console.log(`📊 [5D_POSITIONS] Position bet analysis:`, positionBets);
                        
                        // Check protection conditions
                        const aBets = Object.keys(exposures).filter(key => 
                            key.startsWith('bet:POSITION:A_') && key !== 'bet:POSITION:A_0'
                        );
                        const hasA0Bet = Object.keys(exposures).some(key => key === 'bet:POSITION:A_0');
                        const hasA1to9Bets = aBets.some(bet => bet.match(/A_[1-9]/));
                        const shouldApplyProtection = hasA1to9Bets && !hasA0Bet;
                        
                        console.log(`🛡️ [5D_PROTECTION_STATUS] Protection should be applied: ${shouldApplyProtection ? 'YES' : 'NO'}`);
                        
                        if (shouldApplyProtection) {
                            console.log(`🚨 [5D_PROTECTION_DETAILS] Protection conditions met:`);
                            console.log(`   - A_1-9 bets found: ${aBets.filter(bet => bet.match(/A_[1-9]/)).length}`);
                            console.log(`   - A_0 bet missing: ${!hasA0Bet}`);
                            console.log(`   - Expected result: A=0`);
                        }
                    }
                    
                } catch (error) {
                    console.error(`❌ [5D_ERROR] Error analyzing protection logic for period ${periodId} duration ${duration}s:`, error.message);
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ [5D_ERROR] Error in protection logic analysis:`, error.message);
    }
}

async function monitorExposureData() {
    console.log('\n📊 [5D_MONITOR] === EXPOSURE DATA ANALYSIS ===');
    
    try {
        // Get all 5D keys to find periods with data
        const keys = await redisClient.keys('*5d*');
        const periodIds = new Set();
        
        for (const key of keys) {
            const match = key.match(/bets:5d:(\d+):default:(\d+)|exposure:5d:(\d+):default:(\d+)/);
            if (match) {
                const periodId = match[2] || match[4];
                periodIds.add(periodId);
            }
        }
        
        for (const periodId of periodIds) {
            const durations = [30, 60, 180, 300, 600];
            
            for (const duration of durations) {
                try {
                    const exposureKey = `exposure:5d:${duration}:default:${periodId}`;
                    
                    const exposures = await redisClient.hGetAll(exposureKey);
                    
                    if (Object.keys(exposures).length > 0) {
                        console.log(`\n💰 [5D_EXPOSURE] Duration: ${duration}s, Period: ${periodId}`);
                        console.log(`📊 [5D_EXPOSURE] Total exposure entries: ${Object.keys(exposures).length}`);
                        
                        // Categorize exposures
                        const positionExposures = {};
                        const sumExposures = {};
                        const otherExposures = {};
                        
                        for (const [betKey, exposure] of Object.entries(exposures)) {
                            if (betKey.startsWith('bet:POSITION:')) {
                                positionExposures[betKey] = exposure;
                            } else if (betKey.startsWith('bet:SUM:')) {
                                sumExposures[betKey] = exposure;
                            } else {
                                otherExposures[betKey] = exposure;
                            }
                        }
                        
                        console.log(`🎯 [5D_POSITION_EXPOSURES] Position bets: ${Object.keys(positionExposures).length}`);
                        console.log(`📊 [5D_SUM_EXPOSURES] Sum bets: ${Object.keys(sumExposures).length}`);
                        console.log(`📝 [5D_OTHER_EXPOSURES] Other bets: ${Object.keys(otherExposures).length}`);
                        
                        // Show top exposures
                        const sortedExposures = Object.entries(exposures)
                            .sort(([,a], [,b]) => parseFloat(b) - parseFloat(a))
                            .slice(0, 5);
                        
                        console.log(`🔥 [5D_TOP_EXPOSURES] Top 5 highest exposures:`);
                        sortedExposures.forEach(([betKey, exposure], index) => {
                            console.log(`   ${index + 1}. ${betKey}: ₹${(parseFloat(exposure) / 100).toFixed(2)}`);
                        });
                    }
                    
                } catch (error) {
                    console.error(`❌ [5D_ERROR] Error analyzing exposure data for period ${periodId} duration ${duration}s:`, error.message);
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ [5D_ERROR] Error in exposure data analysis:`, error.message);
    }
}

async function monitorBetDistribution() {
    console.log('\n📊 [5D_MONITOR] === BET DISTRIBUTION ANALYSIS ===');
    
    try {
        // Get all 5D keys to find periods with data
        const keys = await redisClient.keys('*5d*');
        const periodIds = new Set();
        
        for (const key of keys) {
            const match = key.match(/bets:5d:(\d+):default:(\d+)|exposure:5d:(\d+):default:(\d+)/);
            if (match) {
                const periodId = match[2] || match[4];
                periodIds.add(periodId);
            }
        }
        
        for (const periodId of periodIds) {
            const durations = [30, 60, 180, 300, 600];
            
            for (const duration of durations) {
                try {
                    const betHashKey = `bets:5d:${duration}:default:${periodId}`;
                    
                    const bets = await redisClient.hGetAll(betHashKey);
                    
                    if (Object.keys(bets).length > 0) {
                        console.log(`\n📊 [5D_BETS] Duration: ${duration}s, Period: ${periodId}`);
                        console.log(`📈 [5D_BETS] Total bets: ${Object.keys(bets).length}`);
                        
                        const betDetails = Object.values(bets).map(betJson => {
                            try { return JSON.parse(betJson); } catch { return null; }
                        }).filter(Boolean);
                        
                        // Analyze bet types
                        const betTypeCount = {};
                        const betValueCount = {};
                        const userBetCount = {};
                        
                        betDetails.forEach(bet => {
                            const betType = bet.betType || 'UNKNOWN';
                            const betValue = bet.betValue || 'UNKNOWN';
                            const userId = bet.userId || 'UNKNOWN';
                            
                            betTypeCount[betType] = (betTypeCount[betType] || 0) + 1;
                            betValueCount[betValue] = (betValueCount[betValue] || 0) + 1;
                            userBetCount[userId] = (userBetCount[userId] || 0) + 1;
                        });
                        
                        console.log(`🎯 [5D_BET_TYPES] Bet type distribution:`, betTypeCount);
                        console.log(`📊 [5D_BET_VALUES] Top bet values:`, Object.entries(betValueCount)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 5));
                        
                        const uniqueUsers = Object.keys(userBetCount);
                        console.log(`👥 [5D_USERS] Unique users: ${uniqueUsers.length}`);
                        
                        if (uniqueUsers.length > 0) {
                            const topUsers = Object.entries(userBetCount)
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 3);
                            console.log(`🏆 [5D_TOP_USERS] Top users by bet count:`, topUsers);
                        }
                    }
                    
                } catch (error) {
                    console.error(`❌ [5D_ERROR] Error analyzing bet distribution for period ${periodId} duration ${duration}s:`, error.message);
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ [5D_ERROR] Error in bet distribution analysis:`, error.message);
    }
}

// Continuous monitoring
async function startContinuousMonitoring() {
    console.log('🔄 [5D_MONITOR] Starting continuous monitoring...');
    console.log('🔄 [5D_MONITOR] Press Ctrl+C to stop monitoring');
    
    // Initial monitoring
    await monitor5DBets();
    
    // Set up continuous monitoring every 30 seconds
    setInterval(async () => {
        console.log('\n' + '='.repeat(80));
        console.log(`🔄 [5D_MONITOR] ${new Date().toISOString()} - Running continuous check...`);
        await monitor5DBets();
    }, 30000);
}

// Main execution
async function main() {
    try {
        await initializeMonitoring();
        await startContinuousMonitoring();
    } catch (error) {
        console.error('❌ [5D_MONITOR] Fatal error:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 [5D_MONITOR] Shutting down gracefully...');
    await redisClient.quit();
    process.exit(0);
});

// Start monitoring
main(); 