const tronHashService = require('./services/tronHashService');

async function testBlockExtraction() {
    try {
        console.log('🧪 Testing TRON block number extraction...');
        
        // Test with some real TRON hashes from your recent results
        const testHashes = [
            '00000000046a54553fcbca6751fe884da583b58bf919d4389e223c4db89bb1a9',
            '00000000046a544a0bed5ab497d7f203f31caa5283c20e38270e99460bde36e7',
            '00000000046a54509d941670477a0add0be6fb8e154a68693b6bf3f086715982',
            '00000000046a544f7aed2dc68df1e55f461eb3b197653efbf2e697ef304701e0',
            '00000000046a544450df4657b78ef95ae4b560c025aa32ac441fd35a58becc80'
        ];
        
        console.log(`📊 Testing ${testHashes.length} TRON hashes for block extraction...\n`);
        
        for (let i = 0; i < testHashes.length; i++) {
            const hash = testHashes[i];
            console.log(`🔍 Hash ${i + 1}: ${hash}`);
            
            try {
                const blockNumber = await tronHashService.extractBlockNumber(hash);
                console.log(`  📦 Extracted Block Number: ${blockNumber || 'NULL'}`);
                
                if (blockNumber) {
                    console.log(`  ✅ SUCCESS: Block number extracted successfully`);
                    console.log(`  🔗 TRON Link: https://tronscan.org/#/block/${hash}`);
                } else {
                    console.log(`  ❌ FAILED: No block number extracted`);
                }
            } catch (error) {
                console.log(`  ❌ ERROR: ${error.message}`);
            }
            
            console.log('  ---');
            
            // Add delay to avoid overwhelming the API
            if (i < testHashes.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Test with a generated result to see what happens
        console.log('\n🧪 Testing with a new generated result...');
        const testResult = {
            number: 5,
            color: 'red',
            size: 'Small'
        };
        
        const verification = await tronHashService.getResultWithVerification(testResult);
        console.log(`📋 Generated Hash: ${verification.hash}`);
        console.log(`📦 Generated Block Number: ${verification.blockNumber || 'NULL'}`);
        console.log(`⏰ Generated Result Time: ${verification.resultTime}`);
        
        if (verification.blockNumber) {
            console.log('✅ SUCCESS: New results will have block numbers');
        } else {
            console.log('⚠️ WARNING: New results may not have block numbers');
        }
        
        console.log('\n📊 Summary:');
        console.log('- If you see block numbers above, extraction is working');
        console.log('- If you see NULL, there might be an issue with the TRON API or hash format');
        console.log('- Check the TRON links to verify if the hashes are valid');
        
    } catch (error) {
        console.error('❌ Error testing block extraction:', error);
    }
}

// Run the test
testBlockExtraction(); 