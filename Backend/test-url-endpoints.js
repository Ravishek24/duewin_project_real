/**
 * Test script to verify URL endpoints work correctly
 */

const axios = require('axios');

class URLEndpointTester {
    constructor() {
        this.baseURL = 'http://localhost:8000'; // Default port
        this.adminToken = null;
    }

    async testEndpoints() {
        console.log('🧪 Testing URL Endpoints...\n');

        try {
            // Step 1: Test authentication
            await this.testAuthentication();

            if (!this.adminToken) {
                console.log('❌ Cannot test endpoints without admin token');
                return;
            }

            // Step 2: Test both URL patterns
            await this.testOldURLPattern();
            await this.testNewURLPattern();

        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    }

    async testAuthentication() {
        console.log('🔐 Testing Authentication...');
        
        try {
            const response = await axios.post(`${this.baseURL}/api/admin/direct-login`, {
                email: 'admin@example.com'
            });
            
            if (response.data.success && response.data.data.token) {
                this.adminToken = response.data.data.token;
                console.log('✅ Authentication successful');
            } else {
                throw new Error('No token received');
            }
        } catch (error) {
            console.log('❌ Authentication failed:', error.message);
        }
    }

    async testOldURLPattern() {
        console.log('\n📡 Testing OLD URL Pattern: /admin/exposure/wingo/current');
        
        try {
            const response = await axios.get(`${this.baseURL}/admin/exposure/wingo/current`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`
                }
            });
            
            if (response.data.success) {
                console.log('✅ OLD URL pattern works');
                console.log(`   📊 Rooms found: ${Object.keys(response.data.data.rooms || {}).length}`);
            } else {
                console.log('❌ OLD URL pattern failed');
            }
        } catch (error) {
            console.log('❌ OLD URL pattern failed:', error.message);
        }
    }

    async testNewURLPattern() {
        console.log('\n📡 Testing NEW URL Pattern: /api/admin/exposure/wingo/current');
        
        try {
            const response = await axios.get(`${this.baseURL}/api/admin/exposure/wingo/current`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`
                }
            });
            
            if (response.data.success) {
                console.log('✅ NEW URL pattern works');
                console.log(`   📊 Rooms found: ${Object.keys(response.data.data.rooms || {}).length}`);
            } else {
                console.log('❌ NEW URL pattern failed');
            }
        } catch (error) {
            console.log('❌ NEW URL pattern failed:', error.message);
        }
    }

    async testSpecificEndpoints() {
        console.log('\n🎯 Testing Specific Endpoints...');
        
        const endpoints = [
            '/api/admin/exposure/all',
            '/api/admin/exposure/room/30',
            '/api/admin/exposure/room/60',
            '/api/admin/exposure/room/180',
            '/api/admin/exposure/room/300'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(`${this.baseURL}${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${this.adminToken}`
                    }
                });
                
                if (response.data.success) {
                    console.log(`✅ ${endpoint} - OK`);
                } else {
                    console.log(`❌ ${endpoint} - Failed`);
                }
            } catch (error) {
                console.log(`❌ ${endpoint} - Error: ${error.message}`);
            }
        }
    }
}

// Run tests
const tester = new URLEndpointTester();
tester.testEndpoints().then(() => {
    console.log('\n✅ URL endpoint testing completed');
}); 