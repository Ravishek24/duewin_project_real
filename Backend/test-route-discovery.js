const axios = require('axios');

const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJpc19hZG1pbiI6dHJ1ZSwiaWF0IjoxNzUyNDU4MDY4LCJleHAiOjE3NTI1NDQ0Njh9.kxUHGmTKb0Vw_fAFuAsPH5UryCYH5IEJqE6RYk7aLe0';

const BASE_URL = 'http://localhost:8000';

async function testRoutes() {
    const routes = [
        '/api/admin/exposure/wingo/current',
        '/api/admin/exposure/wingo/30/current',
        '/admin/exposure/wingo/current',
        '/admin/exposure/wingo/30/current',
        '/api/admin/exposure/wingo/30/20250714000000651',
        '/admin/exposure/wingo/30/20250714000000651'
    ];

    console.log('🔍 Testing Route Discovery\n');

    for (const route of routes) {
        try {
            const response = await axios.get(`${BASE_URL}${route}`, {
                headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
            });
            console.log(`✅ ${route} - Status: ${response.status}`);
            console.log(`   Response: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${route} - Status: ${error.response.status}`);
                console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
            } else {
                console.log(`❌ ${route} - Error: ${error.message}`);
            }
        }
        console.log('');
    }
}

testRoutes(); 