// Test script to verify admin route security
const axios = require('axios');

const baseURL = 'http://localhost:8000'; // Adjust based on your server

async function testAdminSecurity() {
    console.log('🔒 Testing Admin Route Security...\n');
    
    // Test admin endpoints that should require admin access
    const adminEndpoints = [
        '/api/admin/profile',
        '/api/admin/admins',
        '/api/admin/withdrawals/pending',
        '/api/admin/recharges/pending',
        '/api/admin/stats/total-users'
    ];
    
    console.log('1. Testing access WITHOUT token (should fail):');
    for (const endpoint of adminEndpoints) {
        try {
            const response = await axios.get(`${baseURL}${endpoint}`);
            console.log(`❌ SECURITY ISSUE: ${endpoint} accessible without token!`);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(`✅ ${endpoint}: Properly blocks unauthenticated access`);
            } else {
                console.log(`⚠️ ${endpoint}: Unexpected error - ${error.response?.status}`);
            }
        }
    }
    
    console.log('\n2. Testing access with REGULAR USER token (should fail):');
    console.log('   First, you need to provide a regular user token for testing');
    console.log('   Replace USER_TOKEN_HERE with an actual user token\n');
    
    const userToken = 'USER_TOKEN_HERE'; // Replace with actual user token
    
    if (userToken !== 'USER_TOKEN_HERE') {
        for (const endpoint of adminEndpoints) {
            try {
                const response = await axios.get(`${baseURL}${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${userToken}`
                    }
                });
                console.log(`❌ CRITICAL SECURITY BUG: ${endpoint} accessible with user token!`);
                console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
            } catch (error) {
                if (error.response?.status === 403) {
                    console.log(`✅ ${endpoint}: Properly blocks user access (403 Forbidden)`);
                } else if (error.response?.status === 401) {
                    console.log(`✅ ${endpoint}: Token validation working (401 Unauthorized)`);
                } else {
                    console.log(`⚠️ ${endpoint}: Unexpected error - ${error.response?.status}: ${error.response?.data?.message}`);
                }
            }
        }
    }
    
    console.log('\n3. Summary:');
    console.log('✅ All admin endpoints should return 401 without token');
    console.log('✅ All admin endpoints should return 403 with regular user token');  
    console.log('✅ Admin endpoints should only work with proper admin tokens');
    console.log('\n🔧 If any endpoint shows SECURITY ISSUE, that needs immediate fixing!');
}

// Helper function to check if a user is admin
async function checkUserAdminStatus(token) {
    try {
        const response = await axios.get(`${baseURL}/api/debug/auth`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.data.success) {
            console.log('User details:');
            console.log(`- User ID: ${response.data.user.user_id}`);
            console.log(`- Username: ${response.data.user.user_name}`);
            console.log(`- Is Admin: ${response.data.user.is_admin}`);
            return response.data.user.is_admin;
        }
    } catch (error) {
        console.log('Failed to check user status:', error.response?.data?.message);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testAdminSecurity().catch(console.error);
}

module.exports = { testAdminSecurity, checkUserAdminStatus };