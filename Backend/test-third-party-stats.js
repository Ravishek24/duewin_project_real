const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api/users';
const TEST_TOKEN = 'your_test_token_here'; // Replace with actual test token

// Test the third-party games stats endpoint
const testThirdPartyStats = async () => {
    try {
        console.log('🧪 Testing /third-party-games/stats endpoint...');
        
        const response = await axios.get(`${BASE_URL}/third-party-games/stats`, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                period: 'today'
            }
        });

        console.log('✅ Third-party stats response:', {
            status: response.status,
            success: response.data.success,
            period: response.data.period,
            overall_stats: response.data.overall_stats,
            game_stats: {
                spribe: {
                    provider: response.data.game_stats.spribe?.provider,
                    total_transactions: response.data.game_stats.spribe?.total_transactions,
                    total_bets: response.data.game_stats.spribe?.total_bets,
                    total_wins: response.data.game_stats.spribe?.total_wins
                },
                seamless: {
                    provider: response.data.game_stats.seamless?.provider,
                    total_transactions: response.data.game_stats.seamless?.total_transactions,
                    total_bets: response.data.game_stats.seamless?.total_bets,
                    total_wins: response.data.game_stats.seamless?.total_wins
                }
            }
        });

        return response.data;
    } catch (error) {
        console.error('❌ Error testing third-party stats:', error.response?.data || error.message);
        return null;
    }
};

// Test the third-party games history endpoint
const testThirdPartyHistory = async (gameType = 'spribe') => {
    try {
        console.log(`🧪 Testing /third-party-games/${gameType}/history endpoint...`);
        
        const response = await axios.get(`${BASE_URL}/third-party-games/${gameType}/history`, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                period: 'today',
                page: 1,
                limit: 10
            }
        });

        console.log(`✅ Third-party ${gameType} history response:`, {
            status: response.status,
            success: response.data.success,
            game_type: response.data.game_type,
            provider: response.data.provider,
            period: response.data.period,
            transactions_count: response.data.transactions?.length || 0,
            pagination: response.data.pagination
        });

        return response.data;
    } catch (error) {
        console.error(`❌ Error testing third-party ${gameType} history:`, error.response?.data || error.message);
        return null;
    }
};

// Run all tests
const runTests = async () => {
    console.log('🚀 Starting third-party games statistics tests...\n');

    // Test stats endpoint
    await testThirdPartyStats();
    console.log('\n' + '='.repeat(50) + '\n');

    // Test history endpoints
    await testThirdPartyHistory('spribe');
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testThirdPartyHistory('seamless');
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('✅ All tests completed!');
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    testThirdPartyStats,
    testThirdPartyHistory,
    runTests
}; 