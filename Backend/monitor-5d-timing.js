const unifiedRedis = require('./config/unifiedRedisManager');

async function monitor5DTiming() {
    console.log('🔍 [5D_TIMING_MONITOR] Starting 5D timing monitoring...');
    
    const redis = unifiedRedis.getHelper();
    
    try {
        // Monitor Redis keys for pre-calculation
        console.log('\n📊 Monitoring Redis Keys:');
        
        // Check for any pre-calculation keys
        const keys = await redis.keys('precalc_*');
        console.log(`🔑 Found ${keys.length} pre-calculation keys:`);
        
        for (const key of keys) {
            const ttl = await redis.ttl(key);
            const value = await redis.get(key);
            console.log(`  - ${key}: TTL=${ttl}s, Value=${value ? 'exists' : 'null'}`);
        }
        
        // Check for any lock keys that might be stuck
        const lockKeys = await redis.keys('precalc_lock_*');
        console.log(`🔒 Found ${lockKeys.length} lock keys:`);
        
        for (const key of lockKeys) {
            const ttl = await redis.ttl(key);
            const value = await redis.get(key);
            console.log(`  - ${key}: TTL=${ttl}s, Value=${value || 'null'}`);
            
            if (ttl > 25) {
                console.log(`    ⚠️ WARNING: Lock key ${key} has high TTL (${ttl}s) - might be stuck`);
            }
        }
        
        // Monitor recent 5D results
        console.log('\n📊 Monitoring Recent 5D Results:');
        
        // Check for recent result keys
        const resultKeys = await redis.keys('precalc_result_*');
        console.log(`📈 Found ${resultKeys.length} result keys:`);
        
        for (const key of resultKeys) {
            const ttl = await redis.ttl(key);
            const value = await redis.get(key);
            
            if (value) {
                try {
                    const parsed = JSON.parse(value);
                    const calculatedAt = new Date(parsed.calculatedAt);
                    const age = Date.now() - calculatedAt.getTime();
                    
                    console.log(`  - ${key}:`);
                    console.log(`    TTL: ${ttl}s`);
                    console.log(`    Age: ${Math.round(age / 1000)}s`);
                    console.log(`    Result: ${JSON.stringify(parsed.result)}`);
                    console.log(`    Protection: ${parsed.protectionMode}`);
                    
                    if (age > 120000) { // 2 minutes
                        console.log(`    ⚠️ WARNING: Result is old (${Math.round(age / 1000)}s)`);
                    }
                } catch (parseError) {
                    console.log(`  - ${key}: Parse error - ${parseError.message}`);
                }
            }
        }
        
        // Check system performance
        console.log('\n📊 System Performance Check:');
        
        // Check Redis memory usage
        const info = await redis.info('memory');
        const memoryLines = info.split('\n').filter(line => line.includes('used_memory_human'));
        if (memoryLines.length > 0) {
            console.log(`💾 Redis Memory: ${memoryLines[0].split(':')[1].trim()}`);
        }
        
        // Check Redis connection status
        const clientInfo = await redis.client('info');
        console.log(`🔌 Redis Connections: ${clientInfo.split('\n').filter(line => line.includes('connected_clients')).map(line => line.split(':')[1]).join(', ')}`);
        
        // Monitor timing patterns
        console.log('\n📊 Timing Pattern Analysis:');
        
        // Check if there are any timing-related issues
        const timingKeys = await redis.keys('*timing*');
        console.log(`⏱️ Found ${timingKeys.length} timing-related keys`);
        
        // Check for any error patterns
        const errorKeys = await redis.keys('*error*');
        console.log(`❌ Found ${errorKeys.length} error-related keys`);
        
        // Check for any performance bottlenecks
        const perfKeys = await redis.keys('*performance*');
        console.log(`⚡ Found ${perfKeys.length} performance-related keys`);
        
        // Summary
        console.log('\n📋 MONITORING SUMMARY:');
        console.log(`├─ Pre-calculation keys: ${keys.length}`);
        console.log(`├─ Lock keys: ${lockKeys.length}`);
        console.log(`├─ Result keys: ${resultKeys.length}`);
        console.log(`├─ Timing keys: ${timingKeys.length}`);
        console.log(`├─ Error keys: ${errorKeys.length}`);
        console.log(`└─ Performance keys: ${perfKeys.length}`);
        
        // Check for potential issues
        let issues = 0;
        
        if (lockKeys.length > 0) {
            console.log('⚠️ ISSUE: Found lock keys - potential stuck locks');
            issues++;
        }
        
        if (resultKeys.length > 5) {
            console.log('⚠️ ISSUE: Too many result keys - potential cleanup issues');
            issues++;
        }
        
        if (errorKeys.length > 0) {
            console.log('⚠️ ISSUE: Found error keys - check for recent errors');
            issues++;
        }
        
        if (issues === 0) {
            console.log('✅ No immediate issues detected');
        } else {
            console.log(`⚠️ Found ${issues} potential issues`);
        }
        
    } catch (error) {
        console.error('❌ [5D_TIMING_MONITOR] Monitoring failed:', error.message);
    }
}

// Run monitoring
monitor5DTiming().then(() => {
    console.log('\n🏁 [5D_TIMING_MONITOR] Monitoring completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_TIMING_MONITOR] Monitoring failed:', error);
    process.exit(1);
}); 