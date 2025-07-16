const axios = require('axios');

const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJpc19hZG1pbiI6dHJ1ZSwiaWF0IjoxNzUyNDU4MDY4LCJleHAiOjE3NTI1NDQ0Njh9.kxUHGmTKb0Vw_fAFuAsPH5UryCYH5IEJqE6RYk7aLe0';

const BASE_URL = 'http://localhost:8000';

async function testAvailableRoutes() {
    console.log('🔍 Testing Available Routes\n');

    const routes = [
        // Basic health check
        { path: '/api/health', description: 'API Health Check' },
        
        // Admin routes
        { path: '/admin/direct-login', method: 'POST', description: 'Admin Direct Login' },
        { path: '/admin/exposure/wingo/current', description: 'Admin Exposure Current' },
        { path: '/admin/exposure/wingo/30/current', description: 'Admin Exposure 30s' },
        
        // API admin routes
        { path: '/api/admin/exposure/wingo/current', description: 'API Admin Exposure Current' },
        { path: '/api/admin/exposure/wingo/30/current', description: 'API Admin Exposure 30s' },
        
        // Test different patterns
        { path: '/api/admin/exposure', description: 'API Admin Exposure Base' },
        { path: '/admin/exposure', description: 'Admin Exposure Base' },
        
        // Check if admin routes are mounted
        { path: '/admin', description: 'Admin Base' },
        { path: '/api/admin', description: 'API Admin Base' }
    ];

    for (const route of routes) {
        try {
            const method = route.method || 'GET';
            const config = {
                method: method,
                url: `${BASE_URL}${route.path}`,
                timeout: 5000
            };

            if (method === 'POST') {
                config.headers = { 'Content-Type': 'application/json' };
                config.data = { email: 'admin@duewin.com' };
            } else {
                config.headers = { Authorization: `Bearer ${ADMIN_TOKEN}` };
            }

            const response = await axios(config);
            console.log(`✅ ${route.description}`);
            console.log(`   Path: ${route.path}`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Response: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${route.description}`);
                console.log(`   Path: ${route.path}`);
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
            } else {
                console.log(`❌ ${route.description}`);
                console.log(`   Path: ${route.path}`);
                console.log(`   Error: ${error.message}`);
            }
        }
        console.log('');
    }
}

testAvailableRoutes(); 