const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api/users/admin';
const TEST_USER_ID = '123'; // Replace with an actual user ID from your database
const ADMIN_TOKEN = 'your-admin-token-here'; // Replace with actual admin token

// Test configuration
const testConfig = {
    headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
    }
};

// Test data
const testParams = {
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    page: 1,
    limit: 10
};

async function testEndpoint(endpoint, description) {
    try {
        console.log(`\n🧪 Testing: ${description}`);
        console.log(`📍 Endpoint: ${endpoint}`);
        
        const response = await axios.get(endpoint, testConfig);
        
        if (response.status === 200) {
            const data = response.data;
            
            console.log('✅ Success!');
            console.log(`📊 Response structure:`);
            console.log(`   - Success: ${data.success}`);
            console.log(`   - Data length: ${data.data ? data.data.length : 'N/A'}`);
            
            if (data.pagination) {
                console.log(`📄 Pagination info:`);
                console.log(`   - Total records: ${data.pagination.total}`);
                console.log(`   - Current page: ${data.pagination.page}`);
                console.log(`   - Records per page: ${data.pagination.limit}`);
                console.log(`   - Total pages: ${data.pagination.totalPages}`);
                console.log(`   - Has next page: ${data.pagination.hasNextPage}`);
                console.log(`   - Has prev page: ${data.pagination.hasPrevPage}`);
            }
            
            // Show first record if available
            if (data.data && data.data.length > 0) {
                console.log(`📝 First record sample:`);
                const firstRecord = data.data[0];
                console.log(`   - Game Type: ${firstRecord.game_type}`);
                console.log(`   - Bet ID: ${firstRecord.bet_id}`);
                console.log(`   - Bet Amount: ${firstRecord.bet_amount}`);
                console.log(`   - Win Amount: ${firstRecord.win_amount}`);
                console.log(`   - Status: ${firstRecord.status}`);
                console.log(`   - Created At: ${firstRecord.created_at}`);
                if (firstRecord.wallet_balance_after !== undefined) {
                    console.log(`   - Balance After Bet: ${firstRecord.wallet_balance_after}`);
                }
            }
        } else {
            console.log(`❌ Failed with status: ${response.status}`);
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }
}

async function testPagination() {
    console.log('🚀 Starting Pagination Tests...\n');
    
    // Test all endpoints
    const endpoints = [
        {
            url: `${BASE_URL}/users/${TEST_USER_ID}/bet-history?start_date=${testParams.start_date}&end_date=${testParams.end_date}&page=${testParams.page}&limit=${testParams.limit}`,
            description: 'Bet History with Pagination'
        },
        {
            url: `${BASE_URL}/users/${TEST_USER_ID}/deposit-history?start_date=${testParams.start_date}&end_date=${testParams.end_date}&page=${testParams.page}&limit=${testParams.limit}`,
            description: 'Deposit History with Pagination'
        },
        {
            url: `${BASE_URL}/users/${TEST_USER_ID}/withdrawal-history?start_date=${testParams.start_date}&end_date=${testParams.end_date}&page=${testParams.page}&limit=${testParams.limit}`,
            description: 'Withdrawal History with Pagination'
        },
        {
            url: `${BASE_URL}/users/${TEST_USER_ID}/transaction-history?start_date=${testParams.start_date}&end_date=${testParams.end_date}&page=${testParams.page}&limit=${testParams.limit}`,
            description: 'Transaction History with Pagination'
        }
    ];
    
    for (const endpoint of endpoints) {
        await testEndpoint(endpoint.url, endpoint.description);
    }
    
    // Test pagination with different page numbers
    console.log('\n🔄 Testing different page numbers...');
    await testEndpoint(
        `${BASE_URL}/users/${TEST_USER_ID}/bet-history?start_date=${testParams.start_date}&end_date=${testParams.end_date}&page=2&limit=5`,
        'Bet History - Page 2 with 5 records'
    );
    
    console.log('\n✅ Pagination tests completed!');
}

// Run the tests
if (require.main === module) {
    testPagination().catch(console.error);
}

module.exports = { testPagination };