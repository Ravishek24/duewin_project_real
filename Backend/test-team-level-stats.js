const axios = require('axios');

// Test the new team-level-stats endpoint
async function testTeamLevelStats() {
    try {
        const baseURL = 'http://localhost:3000'; // Adjust if your server runs on different port
        const userId = 13; // Test with user ID 13
        const startDate = '2024-01-01';
        const endDate = '2024-12-31';
        
        // You'll need to get a valid admin token first
        const adminToken = 'YOUR_ADMIN_TOKEN_HERE'; // Replace with actual admin token
        
        const response = await axios.get(`${baseURL}/api/users/admin/users/${userId}/team-level-stats`, {
            params: {
                start_date: startDate,
                end_date: endDate
            },
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Team Level Stats API Response:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error testing team-level-stats endpoint:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Test without date parameters
async function testTeamLevelStatsNoDates() {
    try {
        const baseURL = 'http://localhost:3000';
        const userId = 13;
        
        const adminToken = 'YOUR_ADMIN_TOKEN_HERE'; // Replace with actual admin token
        
        const response = await axios.get(`${baseURL}/api/users/admin/users/${userId}/team-level-stats`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Team Level Stats API Response (no dates):');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error testing team-level-stats endpoint (no dates):');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run tests
console.log('Testing team-level-stats endpoint...\n');

// Test with date parameters
testTeamLevelStats().then(() => {
    console.log('\n' + '='.repeat(50) + '\n');
    // Test without date parameters
    return testTeamLevelStatsNoDates();
}).catch(console.error); 