const tronHashService = require('./services/tronHashService');

async function testTrxBlockAndTime() {
    try {
        console.log('🧪 Testing TRX Block Number and Time Functionality');
        console.log('==================================================');

        // Test with a real TRON hash
        const testResult = {
            number: 5,
            color: 'green_violet',
            size: 'Big',
            parity: 'odd'
        };

        console.log('\n🔍 Testing result:', testResult);

        // Test getCurrentISTTime
        console.log('\n🔍 Testing getCurrentISTTime:');
        const istTime = tronHashService.getCurrentISTTime();
        console.log(`IST Time: ${istTime.toISOString()}`);
        console.log(`IST Time (Local): ${istTime.toString()}`);

        // Test extractBlockNumber with a real TRON hash
        console.log('\n🔍 Testing extractBlockNumber:');
        const realHash = '00000000046a5185c55cbf7bec62f6157b6347596d2e926f3300682173e205ef';
        const blockNumber = await tronHashService.extractBlockNumber(realHash);
        console.log(`Hash: ${realHash}`);
        console.log(`Extracted Block Number: ${blockNumber}`);

        // Test getResultWithVerification with new fields
        console.log('\n🔍 Testing getResultWithVerification with new fields:');
        try {
            const verification = await tronHashService.getResultWithVerification(testResult, 30);
            
            console.log(`Result: ${testResult.number}`);
            console.log(`Hash: ${verification.hash}`);
            console.log(`Link: ${verification.link}`);
            console.log(`Block Number: ${verification.blockNumber}`);
            console.log(`Result Time: ${verification.resultTime}`);
            
            // Verify the hash ends with the correct digit
            const lastDigit = tronHashService.getLastDigit(verification.hash);
            console.log(`Hash ends with: ${lastDigit} (expected: ${testResult.number})`);
            console.log(`Hash verification: ${lastDigit === testResult.number ? '✅' : '❌'}`);
            
            // Verify block number and time are present
            console.log(`Block number present: ${verification.blockNumber !== null ? '✅' : '❌'}`);
            console.log(`Result time present: ${verification.resultTime ? '✅' : '❌'}`);
            
            if (verification.blockNumber !== null) {
                console.log(`✅ Block number extracted successfully: ${verification.blockNumber}`);
            } else {
                console.log(`⚠️ Block number is null (this is normal for generated hashes)`);
            }
            
            if (verification.resultTime) {
                console.log(`✅ Result time generated successfully: ${verification.resultTime.toISOString()}`);
            } else {
                console.log(`❌ Result time is missing`);
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }

        // Test with different result numbers
        console.log('\n🔍 Testing with different result numbers:');
        for (let i = 0; i < 3; i++) {
            const testResult2 = {
                number: i,
                color: 'red',
                size: 'Small',
                parity: 'even'
            };
            
            try {
                const verification2 = await tronHashService.getResultWithVerification(testResult2, 30);
                const lastDigit2 = tronHashService.getLastDigit(verification2.hash);
                
                console.log(`Result ${i}: Hash ends with ${lastDigit2}, Block: ${verification2.blockNumber}, Time: ${verification2.resultTime ? 'Present' : 'Missing'}`);
            } catch (error) {
                console.log(`Result ${i}: Error - ${error.message}`);
            }
        }

        console.log('\n🎯 Test completed!');

    } catch (error) {
        console.error('❌ Error in test:', error);
        throw error;
    }
}

// Run the test
testTrxBlockAndTime().catch(console.error); 