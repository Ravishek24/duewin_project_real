const axios = require('axios');

async function testTrxHistoryResponse() {
    try {
        console.log('🧪 Testing TRX_WIX history API response...');
        
        // Test the history endpoint
        const response = await axios.get('http://localhost:3000/api/games/trx_wix/30/history?limit=5');
        
        if (response.data.success) {
            console.log('✅ API Response successful');
            console.log(`📊 Found ${response.data.data.results.length} results`);
            
            // Check each result for block and time
            response.data.data.results.forEach((result, index) => {
                console.log(`\n📋 Result ${index + 1}:`);
                console.log(`  Period: ${result.periodId}`);
                console.log(`  Number: ${result.result.number}`);
                console.log(`  Color: ${result.result.color}`);
                console.log(`  Hash: ${result.verification.hash}`);
                console.log(`  Link: ${result.verification.link}`);
                console.log(`  Block: ${result.verification.block || 'null'}`);
                console.log(`  Time: ${result.verification.time || 'null'}`);
                
                // Check if block and time are present
                if (result.verification.block) {
                    console.log(`  ✅ Block number present: ${result.verification.block}`);
                } else {
                    console.log(`  ⚠️ Block number missing (may be older record)`);
                }
                
                if (result.verification.time) {
                    console.log(`  ✅ Result time present: ${result.verification.time}`);
                } else {
                    console.log(`  ⚠️ Result time missing (may be older record)`);
                }
            });
            
            // Summary
            const resultsWithBlock = response.data.data.results.filter(r => r.verification.block);
            const resultsWithTime = response.data.data.results.filter(r => r.verification.time);
            
            console.log('\n📊 Summary:');
            console.log(`📦 Results with block number: ${resultsWithBlock.length}/${response.data.data.results.length}`);
            console.log(`⏰ Results with result time: ${resultsWithTime.length}/${response.data.data.results.length}`);
            
        } else {
            console.log('❌ API Response failed:', response.data.message);
        }
        
    } catch (error) {
        console.error('❌ Error testing API:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testTrxHistoryResponse(); 