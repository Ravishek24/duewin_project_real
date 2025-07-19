const tronHashService = require('./services/tronHashService');

async function testTrxHashVerification() {
    try {
        console.log('🧪 Testing TRX Hash Verification Fix');
        console.log('=====================================');

        // Test the getLastDigit function with sample hashes
        console.log('\n🔍 Testing getLastDigit function:');
        const testHashes = [
            '00000000046a4fbcf6e5c258f5c79eb28281ad45b3cd0c7baca0cf8d0a4e2fc5', // should end with 5
            '25a860841982b588e464ebdb85ff4b2d4252228e813bf27e4e72e7b26a4e231f', // should end with 1
            '315fa2083c4f09efee00bad6e102718e311c5a009d3ec3be029b6021b29d287d', // should end with 7
            '79895a2fe2bf84886ab75ecb6f317985c1cb93b050c0284740efbc37d2010197', // should end with 7
            '00000000046a503955ce9be90d878816779995f2b6c36722de1e1a5f77c3f952'  // should end with 2
        ];

        testHashes.forEach(hash => {
            const lastDigit = tronHashService.getLastDigit(hash);
            console.log(`Hash: ${hash.substring(0, 16)}...${hash.substring(hash.length - 16)}`);
            console.log(`Last digit: ${lastDigit}`);
            console.log('---');
        });

        // Test findHashEndingWithDigit function
        console.log('\n🔍 Testing findHashEndingWithDigit function:');
        const targetDigit = 3;
        const matchingHash = tronHashService.findHashEndingWithDigit(targetDigit, testHashes);
        console.log(`Looking for hash ending with ${targetDigit}:`);
        console.log(matchingHash ? `Found: ${matchingHash}` : 'Not found in test hashes');

        // Test generateHashEndingWithDigit function
        console.log('\n🔍 Testing generateHashEndingWithDigit function:');
        for (let i = 0; i < 5; i++) {
            const generatedHash = tronHashService.generateHashEndingWithDigit(i);
            const lastDigit = tronHashService.getLastDigit(generatedHash);
            console.log(`Generated hash ending with ${i}: ${generatedHash}`);
            console.log(`Verified last digit: ${lastDigit} (${lastDigit === i ? '✅' : '❌'})`);
            console.log('---');
        }

        // Test getResultWithVerification with different result numbers
        console.log('\n🔍 Testing getResultWithVerification function:');
        for (let resultNumber = 0; resultNumber < 5; resultNumber++) {
            console.log(`\nTesting result number: ${resultNumber}`);
            const testResult = {
                number: resultNumber,
                color: 'red',
                size: 'Small',
                parity: 'odd'
            };

            try {
                const verification = await tronHashService.getResultWithVerification(testResult, 30);
                const actualLastDigit = tronHashService.getLastDigit(verification.hash);
                
                console.log(`Result: ${resultNumber}`);
                console.log(`Hash: ${verification.hash}`);
                console.log(`Link: ${verification.link}`);
                console.log(`Hash ends with: ${actualLastDigit}`);
                console.log(`Match: ${actualLastDigit === resultNumber ? '✅' : '❌'}`);
                
                if (actualLastDigit !== resultNumber) {
                    console.log('❌ VERIFICATION FAILED!');
                } else {
                    console.log('✅ VERIFICATION SUCCESSFUL!');
                }
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
        }

        console.log('\n🎯 Test completed!');

    } catch (error) {
        console.error('❌ Error in test:', error);
        throw error;
    }
}

// Run the test
testTrxHashVerification().catch(console.error); 