let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




async function test5DDurationValidation() {
    const client = 
    
    try {
        await client.connect();
        console.log('🧪 Testing 5D duration validation...');
        
        // Test 1: Try to place 5D bet with invalid duration (30s)
        console.log('\n🧪 Test 1: Attempting 5D bet with invalid duration (30s)');
        const invalidBetData = {
            gameType: '5d',
            duration: 30,
            periodId: '20241201003',
            amount: 100,
            type: 'number',
            selection: '5',
            position: 'A'
        };
        
        console.log('📝 Invalid bet data:', JSON.stringify(invalidBetData, null, 2));
        console.log('❌ This should be rejected by the validation we added');
        
        // Test 2: Try to place 5D bet with valid duration (60s)
        console.log('\n🧪 Test 2: Attempting 5D bet with valid duration (60s)');
        const validBetData = {
            gameType: '5d',
            duration: 60,
            periodId: '20241201003',
            amount: 100,
            type: 'number',
            selection: '5',
            position: 'A'
        };
        
        console.log('📝 Valid bet data:', JSON.stringify(validBetData, null, 2));
        console.log('✅ This should be accepted by the validation');
        
        // Test 3: Check current Redis state
        console.log('\n🧪 Test 3: Checking current Redis state');
        const all5DKeys = await client.keys('*5d*');
        console.log(`📊 Total 5D keys in Redis: ${all5DKeys.length}`);
        
        if (all5DKeys.length > 0) {
            console.log('📋 5D keys found:');
            all5DKeys.forEach(key => {
                const match = key.match(/5d:(\d+):/);
                if (match) {
                    const duration = parseInt(match[1]);
                    const isValid = [60, 180, 300, 600].includes(duration);
                    console.log(`  ${key} - Duration: ${duration}s - Valid: ${isValid ? '✅' : '❌'}`);
                } else {
                    console.log(`  ${key} - Duration: unknown`);
                }
            });
        }
        
        // Test 4: Validate game configurations
        console.log('\n🧪 Test 4: Validating game configurations');
        const GAME_CONFIGS = {
            wingo: [30, 60, 180, 300],
            trx_wix: [30, 60, 180, 300],
            fiveD: [60, 180, 300, 600],
            k3: [60, 180, 300, 600]
        };
        
        console.log('📋 Game configurations:');
        Object.entries(GAME_CONFIGS).forEach(([game, durations]) => {
            console.log(`  ${game}: ${durations.join(', ')}s`);
        });
        
        // Test 5: Validate specific 5D durations
        console.log('\n🧪 Test 5: Validating 5D durations');
        const valid5DDurations = GAME_CONFIGS.fiveD;
        const testDurations = [30, 60, 180, 300, 600];
        
        testDurations.forEach(duration => {
            const isValid = valid5DDurations.includes(duration);
            console.log(`  5D ${duration}s: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
        });
        
        console.log('\n✅ 5D duration validation test completed');
        
    } catch (error) {
        console.error('❌ Error during test:', error);
    } finally {
        await client.disconnect();
        console.log('🔚 Test completed');
    }
}

// Run test
test5DDurationValidation().catch(console.error); 
module.exports = { setRedisHelper };
