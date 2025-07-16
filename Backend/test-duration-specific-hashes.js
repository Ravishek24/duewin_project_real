const tronHashService = require('./services/tronHashService');
const redisClient = require('./config/redisConfig').redis;

async function testDurationSpecificHashes() {
    try {
        console.log('🧪 Testing Duration-Specific Hash Generation for TRX_WIX');
        console.log('=====================================================');

        // Get all TRX_WIX durations
        const durations = tronHashService.getTrxWixDurations();
        console.log('📋 TRX_WIX Durations:', durations);

        // Test hash generation for each duration
        const results = {};
        
        for (const duration of durations) {
            console.log(`\n🔄 Testing duration: ${duration}s`);
            
            // Create a test result
            const testResult = {
                number: Math.floor(Math.random() * 10),
                color: 'red',
                size: 'Small'
            };
            
            // Get verification with duration
            const verification = await tronHashService.getResultWithVerification(testResult, duration);
            
            results[duration] = {
                result: testResult,
                hash: verification.hash,
                link: verification.link
            };
            
            console.log(`✅ Duration ${duration}s:`, {
                result: testResult.number,
                hash: verification.hash.substring(0, 16) + '...',
                link: verification.link
            });
        }

        // Check if all hashes are unique
        const allHashes = Object.values(results).map(r => r.hash);
        const uniqueHashes = new Set(allHashes);
        
        console.log('\n🔍 Hash Uniqueness Check:');
        console.log(`Total hashes: ${allHashes.length}`);
        console.log(`Unique hashes: ${uniqueHashes.size}`);
        
        if (allHashes.length === uniqueHashes.size) {
            console.log('✅ SUCCESS: All hashes are unique!');
        } else {
            console.log('❌ FAILURE: Some hashes are duplicated!');
        }

        // Check Redis keys for each duration
        console.log('\n📊 Redis Hash Collection Status:');
        for (const duration of durations) {
            const key = tronHashService.getDurationHashKey(duration);
            const hasEnough = await tronHashService.hasEnoughHashes(duration);
            console.log(`Duration ${duration}s (${key}): ${hasEnough ? '✅ Has enough hashes' : '❌ Needs more hashes'}`);
        }

        // Show sample hashes from each duration collection
        console.log('\n🔍 Sample Hashes from Each Duration Collection:');
        for (const duration of durations) {
            const key = tronHashService.getDurationHashKey(duration);
            const collection = await redisClient.get(key);
            
            if (collection) {
                const parsed = JSON.parse(collection);
                const sampleHashes = Object.entries(parsed).slice(0, 3).map(([digit, hashes]) => ({
                    digit,
                    count: hashes.length,
                    sample: hashes[0] ? hashes[0].substring(0, 16) + '...' : 'None'
                }));
                
                console.log(`Duration ${duration}s:`);
                sampleHashes.forEach(({ digit, count, sample }) => {
                    console.log(`  Digit ${digit}: ${count} hashes, Sample: ${sample}`);
                });
            } else {
                console.log(`Duration ${duration}s: No collection found`);
            }
        }

        return results;

    } catch (error) {
        console.error('❌ Error testing duration-specific hashes:', error);
        throw error;
    }
}

async function startHashCollection() {
    try {
        console.log('\n🚀 Starting hash collection for all durations...');
        await tronHashService.startHashCollection();
        console.log('✅ Hash collection completed');
    } catch (error) {
        console.error('❌ Error in hash collection:', error);
    }
}

async function main() {
    try {
        // First start hash collection
        await startHashCollection();
        
        // Wait a bit for collection to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Then test the functionality
        await testDurationSpecificHashes();
        
        console.log('\n🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Close Redis connection
        await redisClient.quit();
        process.exit(0);
    }
}

// Run the test
main(); 