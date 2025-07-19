const { getThirdPartyGamesStats, getThirdPartyGameHistory, statsCache } = require('./services/thirdPartyGamesStatsService');

/**
 * Performance monitoring for third-party games statistics
 */
const monitorPerformance = async () => {
    console.log('🚀 Starting Third-Party Games Performance Monitoring...\n');

    const testUserId = 1; // Replace with actual test user ID
    const iterations = 5;

    // Test 1: Statistics Query Performance
    console.log('📊 Testing Statistics Query Performance:');
    const statsTimes = [];
    
    for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
            const result = await getThirdPartyGamesStats(testUserId, 'today');
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            statsTimes.push(duration);
            
            console.log(`  Run ${i + 1}: ${duration}ms - Success: ${result.success}`);
            
            // Test cache on subsequent runs
            if (i > 0) {
                const cacheStartTime = Date.now();
                const cacheResult = await getThirdPartyGamesStats(testUserId, 'today');
                const cacheEndTime = Date.now();
                const cacheDuration = cacheEndTime - cacheStartTime;
                
                console.log(`  Cache Run ${i + 1}: ${cacheDuration}ms - Success: ${cacheResult.success}`);
            }
        } catch (error) {
            console.error(`  Run ${i + 1}: Error - ${error.message}`);
        }
    }

    // Calculate statistics
    const avgStatsTime = statsTimes.reduce((a, b) => a + b, 0) / statsTimes.length;
    const minStatsTime = Math.min(...statsTimes);
    const maxStatsTime = Math.max(...statsTimes);
    
    console.log(`\n📈 Statistics Query Performance Summary:`);
    console.log(`  Average: ${avgStatsTime.toFixed(2)}ms`);
    console.log(`  Min: ${minStatsTime}ms`);
    console.log(`  Max: ${maxStatsTime}ms`);
    console.log(`  Cache Size: ${statsCache.size} entries`);

    // Test 2: History Query Performance
    console.log('\n📋 Testing History Query Performance:');
    const historyTimes = [];
    
    for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
            const result = await getThirdPartyGameHistory(testUserId, 'spribe', 'today', 1, 20);
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            historyTimes.push(duration);
            
            console.log(`  Spribe Run ${i + 1}: ${duration}ms - Records: ${result.transactions?.length || 0}`);
        } catch (error) {
            console.error(`  Spribe Run ${i + 1}: Error - ${error.message}`);
        }
    }

    // Calculate history statistics
    const avgHistoryTime = historyTimes.reduce((a, b) => a + b, 0) / historyTimes.length;
    const minHistoryTime = Math.min(...historyTimes);
    const maxHistoryTime = Math.max(...historyTimes);
    
    console.log(`\n📈 History Query Performance Summary:`);
    console.log(`  Average: ${avgHistoryTime.toFixed(2)}ms`);
    console.log(`  Min: ${minHistoryTime}ms`);
    console.log(`  Max: ${maxHistoryTime}ms`);

    // Test 3: Seamless History Performance
    console.log('\n🎮 Testing Seamless History Performance:');
    const seamlessHistoryTimes = [];
    
    for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
            const result = await getThirdPartyGameHistory(testUserId, 'seamless', 'today', 1, 20);
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            seamlessHistoryTimes.push(duration);
            
            console.log(`  Seamless Run ${i + 1}: ${duration}ms - Records: ${result.transactions?.length || 0}`);
        } catch (error) {
            console.error(`  Seamless Run ${i + 1}: Error - ${error.message}`);
        }
    }

    // Calculate seamless history statistics
    const avgSeamlessTime = seamlessHistoryTimes.reduce((a, b) => a + b, 0) / seamlessHistoryTimes.length;
    const minSeamlessTime = Math.min(...seamlessHistoryTimes);
    const maxSeamlessTime = Math.max(...seamlessHistoryTimes);
    
    console.log(`\n📈 Seamless History Performance Summary:`);
    console.log(`  Average: ${avgSeamlessTime.toFixed(2)}ms`);
    console.log(`  Min: ${minSeamlessTime}ms`);
    console.log(`  Max: ${maxSeamlessTime}ms`);

    // Performance Recommendations
    console.log('\n💡 Performance Recommendations:');
    
    if (avgStatsTime > 1000) {
        console.log('  ⚠️  Statistics queries are slow (>1s). Consider:');
        console.log('     - Adding more database indexes');
        console.log('     - Implementing Redis caching');
        console.log('     - Optimizing the aggregation queries');
    } else if (avgStatsTime > 500) {
        console.log('  ⚠️  Statistics queries are moderate (>500ms). Consider:');
        console.log('     - Reviewing database indexes');
        console.log('     - Increasing cache TTL');
    } else {
        console.log('  ✅ Statistics queries are performing well (<500ms)');
    }

    if (avgHistoryTime > 500) {
        console.log('  ⚠️  History queries are slow (>500ms). Consider:');
        console.log('     - Adding pagination indexes');
        console.log('     - Reducing the number of selected fields');
    } else {
        console.log('  ✅ History queries are performing well (<500ms)');
    }

    // Cache Performance
    console.log('\n🗄️  Cache Performance:');
    console.log(`  Cache Hit Rate: ${statsCache.size > 0 ? 'Active' : 'No cache hits yet'}`);
    console.log(`  Cache Size: ${statsCache.size} entries`);
    
    if (statsCache.size > 50) {
        console.log('  ⚠️  Cache size is large. Consider reducing TTL or implementing LRU eviction');
    }

    console.log('\n✅ Performance monitoring completed!');
};

// Run monitoring if this file is executed directly
if (require.main === module) {
    monitorPerformance().catch(console.error);
}

module.exports = {
    monitorPerformance
}; 