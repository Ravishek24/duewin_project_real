let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



const { CACHE } = require('./config/constants');

// Redis configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    keyPrefix: CACHE.PREFIX,
    retryStrategy: function(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

// Create Redis client
const redisClient = 

async function showK3Exposure() {
    try {
        console.log('🎲 [K3_EXPOSURE_VIEWER] Current K3 Exposure Data');
        console.log('===============================================');

        // Get all K3 exposure keys
        const pattern = 'exposure:k3:*';
        const keys = await redisClient.keys(pattern);
        
        console.log(`\n📊 Found ${keys.length} K3 exposure keys:`);
        
        if (keys.length === 0) {
            console.log('No K3 exposure data found in Redis.');
            return;
        }

        // Show recent exposure keys (last 5)
        const recentKeys = keys.slice(-5);
        console.log('\n🔍 Recent K3 Exposure Keys:');
        recentKeys.forEach((key, index) => {
            console.log(`  ${index + 1}. ${key}`);
        });

        // Analyze the most recent exposure
        const mostRecentKey = keys[keys.length - 1];
        console.log(`\n📈 Analyzing most recent exposure: ${mostRecentKey}`);
        
        const exposureData = await redisClient.hgetall(mostRecentKey);
        const exposureCount = Object.keys(exposureData).length;
        
        console.log(`\n📊 Exposure Statistics:`);
        console.log(`  Total exposure entries: ${exposureCount}`);
        console.log(`  Expected combinations: 216`);
        console.log(`  Coverage: ${(exposureCount / 216 * 100).toFixed(1)}%`);

        if (exposureCount > 0) {
            // Show exposure distribution
            console.log('\n💰 Exposure Distribution:');
            
            // Group by exposure amounts
            const exposureGroups = {};
            for (const [key, value] of Object.entries(exposureData)) {
                const exposureInRupees = parseInt(value) / 100;
                const group = Math.floor(exposureInRupees / 100) * 100; // Group by 100s
                if (!exposureGroups[group]) {
                    exposureGroups[group] = { count: 0, total: 0 };
                }
                exposureGroups[group].count++;
                exposureGroups[group].total += exposureInRupees;
            }

            Object.entries(exposureGroups)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .forEach(([group, data]) => {
                    const avgExposure = data.total / data.count;
                    console.log(`  ₹${group}-${parseInt(group) + 99}: ${data.count} combinations, Avg: ₹${avgExposure.toFixed(2)}`);
                });

            // Show highest exposures
            console.log('\n🔥 Highest Exposures:');
            const sortedExposures = Object.entries(exposureData)
                .map(([key, value]) => ({
                    key,
                    exposure: parseInt(value) / 100
                }))
                .sort((a, b) => b.exposure - a.exposure)
                .slice(0, 10);

            sortedExposures.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.key}: ₹${item.exposure.toFixed(2)}`);
            });

            // Show lowest exposures
            console.log('\n❄️ Lowest Exposures:');
            const lowestExposures = Object.entries(exposureData)
                .map(([key, value]) => ({
                    key,
                    exposure: parseInt(value) / 100
                }))
                .sort((a, b) => a.exposure - b.exposure)
                .slice(0, 10);

            lowestExposures.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.key}: ₹${item.exposure.toFixed(2)}`);
            });

            // Calculate total exposure
            const totalExposure = Object.values(exposureData).reduce((sum, value) => sum + parseInt(value), 0) / 100;
            console.log(`\n💸 Total Exposure: ₹${totalExposure.toFixed(2)}`);
            console.log(`📊 Average Exposure per Combination: ₹${(totalExposure / 216).toFixed(2)}`);

            // Show zero exposure combinations
            const zeroExposureCount = 216 - exposureCount;
            console.log(`\n🎯 Zero Exposure Combinations: ${zeroExposureCount}`);
            console.log(`📈 Zero Exposure Percentage: ${(zeroExposureCount / 216 * 100).toFixed(1)}%`);

            // Memory usage
            const avgKeySize = 20;
            const avgValueSize = 10;
            const memoryUsage = exposureCount * (avgKeySize + avgValueSize);
            console.log(`\n💾 Estimated Memory Usage: ${memoryUsage} bytes (${(memoryUsage / 1024).toFixed(2)} KB)`);
        }

        // Show TTL for the key
        const ttl = await redisClient.ttl(mostRecentKey);
        console.log(`\n⏰ Key TTL: ${ttl} seconds (${(ttl / 60).toFixed(1)} minutes)`);

        // Show all exposure keys with their sizes
        console.log('\n📋 All K3 Exposure Keys:');
        for (const key of keys.slice(-10)) { // Show last 10 keys
            const keyData = await redisClient.hgetall(key);
            const keySize = Object.keys(keyData).length;
            const keyTTL = await redisClient.ttl(key);
            console.log(`  ${key}: ${keySize} entries, TTL: ${keyTTL}s`);
        }

    } catch (error) {
        console.error('❌ Error showing K3 exposure:', error);
    } finally {
        await redisClient.quit();
        process.exit(0);
    }
}

// Run the viewer
showK3Exposure(); 
module.exports = { setRedisHelper };
