const axios = require('axios');

const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJpc19hZG1pbiI6dHJ1ZSwiaWF0IjoxNzUyNDU4MDY4LCJleHAiOjE3NTI1NDQ0Njh9.kxUHGmTKb0Vw_fAFuAsPH5UryCYH5IEJqE6RYk7aLe0';

// Test different server URLs
const serverUrls = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://0.0.0.0:8000',
    'http://172.31.33.222:8000',  // Your server IP
    'http://172.31.33.222:3000',  // Common alternative port
    'http://172.31.33.222:5000',  // Another common port
    'http://172.31.33.222:8080'   // Another common port
];

async function testServerConnection() {
    console.log('🔍 Testing Server Connection\n');

    for (const baseUrl of serverUrls) {
        try {
            console.log(`Testing: ${baseUrl}`);
            
            // Test basic server response
            const response = await axios.get(`${baseUrl}/api/health`, { timeout: 5000 });
            console.log(`✅ Server is running on: ${baseUrl}`);
            console.log(`   Status: ${response.status}`);
            
            // Test admin exposure endpoint
            try {
                const adminResponse = await axios.get(`${baseUrl}/api/admin/exposure/wingo/current`, {
                    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
                    timeout: 5000
                });
                console.log(`✅ Admin exposure endpoint working on: ${baseUrl}`);
                console.log(`   Response: ${JSON.stringify(adminResponse.data, null, 2).substring(0, 200)}...`);
            } catch (adminError) {
                if (adminError.response) {
                    console.log(`⚠️ Admin endpoint error: ${adminError.response.status} - ${JSON.stringify(adminError.response.data)}`);
                } else {
                    console.log(`❌ Admin endpoint error: ${adminError.message}`);
                }
            }
            
            return baseUrl; // Found working server
            
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.log(`❌ Connection refused: ${baseUrl}`);
            } else if (error.code === 'ENOTFOUND') {
                console.log(`❌ Host not found: ${baseUrl}`);
            } else {
                console.log(`❌ Error: ${error.message}`);
            }
        }
        console.log('');
    }
    
    console.log('❌ No working server found');
    return null;
}

testServerConnection(); 