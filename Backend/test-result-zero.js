const tronHashService = require('./services/tronHashService');

async function testResultZero() {
    try {
        console.log('🧪 Testing TRX Result 0 Fix');
        console.log('============================');

        // Test with result 0
        const testResult = {
            number: 0,
            color: 'red_violet',
            size: 'Small',
            parity: 'even'
        };

        console.log('\n🔍 Testing result:', testResult);

        // Test getLastDigit function with a hash ending in 0
        console.log('\n🔍 Testing getLastDigit with hash ending in 0:');
        const testHash = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1230';
        const lastDigit = tronHashService.getLastDigit(testHash);
        console.log(`Hash: ${testHash}`);
        console.log(`Last digit: ${lastDigit} (expected: 0)`);
        console.log(`Match: ${lastDigit === 0 ? '✅' : '❌'}`);

        // Test generateHashEndingWithDigit with 0
        console.log('\n🔍 Testing generateHashEndingWithDigit with 0:');
        const generatedHash = tronHashService.generateHashEndingWithDigit(0);
        const generatedLastDigit = tronHashService.getLastDigit(generatedHash);
        console.log(`Generated hash: ${generatedHash}`);
        console.log(`Last digit: ${generatedLastDigit} (expected: 0)`);
        console.log(`Match: ${generatedLastDigit === 0 ? '✅' : '❌'}`);

        // Test findHashEndingWithDigit with 0
        console.log('\n🔍 Testing findHashEndingWithDigit with 0:');
        const testHashes = [
            'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1231', // ends with 1
            'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1230', // ends with 0
            'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1232'  // ends with 2
        ];
        const foundHash = tronHashService.findHashEndingWithDigit(0, testHashes);
        console.log(`Found hash ending with 0: ${foundHash}`);
        console.log(`Success: ${foundHash ? '✅' : '❌'}`);

        // Test getResultWithVerification with result 0
        console.log('\n🔍 Testing getResultWithVerification with result 0:');
        try {
            const verification = await tronHashService.getResultWithVerification(testResult, 30);
            const actualLastDigit = tronHashService.getLastDigit(verification.hash);
            
            console.log(`Result: ${testResult.number}`);
            console.log(`Hash: ${verification.hash}`);
            console.log(`Link: ${verification.link}`);
            console.log(`Hash ends with: ${actualLastDigit}`);
            console.log(`Match: ${actualLastDigit === 0 ? '✅' : '❌'}`);
            
            if (actualLastDigit !== 0) {
                console.log('❌ VERIFICATION FAILED!');
            } else {
                console.log('✅ VERIFICATION SUCCESSFUL!');
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }

        console.log('\n🎯 Test completed!');

    } catch (error) {
        console.error('❌ Error in test:', error);
        throw error;
    }
}

// Run the test
testResultZero().catch(console.error); 