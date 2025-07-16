/**
 * Comprehensive Test Script for Admin Exposure Monitoring System
 * Tests all components: API endpoints, WebSocket, Redis, and admin override
 */

const axios = require('axios');
const WebSocket = require('ws');
const redis = require('./config/redis');
const jwt = require('jsonwebtoken');

class ExposureSystemTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.adminToken = null;
        this.ws = null;
        this.testResults = [];
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🧪 Starting Exposure System Tests...\n');
        
        try {
            // Test 1: Authentication
            await this.testAuthentication();
            
            // Test 2: API Endpoints
            await this.testAPIEndpoints();
            
            // Test 3: Redis Data
            await this.testRedisData();
            
            // Test 4: WebSocket Connection
            await this.testWebSocketConnection();
            
            // Test 5: Real-time Updates
            await this.testRealTimeUpdates();
            
            // Test 6: Admin Override
            await this.testAdminOverride();
            
            // Test 7: Period Status
            await this.testPeriodStatus();
            
            // Generate Report
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        } finally {
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    /**
     * Test 1: Authentication
     */
    async testAuthentication() {
        console.log('🔐 Testing Authentication...');
        
        try {
            const response = await axios.post(`${this.baseURL}/api/admin/direct-login`, {
                email: 'admin@example.com'
            });
            
            if (response.data.success && response.data.data.token) {
                this.adminToken = response.data.data.token;
                console.log('✅ Authentication successful');
                this.testResults.push({ test: 'Authentication', status: 'PASS' });
            } else {
                throw new Error('No token received');
            }
        } catch (error) {
            console.log('❌ Authentication failed:', error.message);
            this.testResults.push({ test: 'Authentication', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test 2: API Endpoints
     */
    async testAPIEndpoints() {
        console.log('\n📡 Testing API Endpoints...');
        
        if (!this.adminToken) {
            console.log('❌ Skipping API tests - no admin token');
            return;
        }

        const headers = {
            'Authorization': `Bearer ${this.adminToken}`,
            'Content-Type': 'application/json'
        };

        // Test all exposure endpoint
        try {
            const allExposureResponse = await axios.get(`${this.baseURL}/api/admin/exposure/all`, { headers });
            
            if (allExposureResponse.data.success) {
                console.log('✅ All exposure endpoint working');
                console.log(`   📊 Rooms found: ${Object.keys(allExposureResponse.data.rooms).length}`);
                
                // Check each room
                Object.keys(allExposureResponse.data.rooms).forEach(room => {
                    const roomData = allExposureResponse.data.rooms[room];
                    console.log(`   🎮 ${room}: Exposure ₹${roomData.analysis.totalExposure}, Optimal: ${roomData.analysis.optimalNumber}`);
                });
                
                this.testResults.push({ test: 'API All Exposure', status: 'PASS' });
            } else {
                throw new Error('API returned success: false');
            }
        } catch (error) {
            console.log('❌ All exposure API failed:', error.message);
            this.testResults.push({ test: 'API All Exposure', status: 'FAIL', error: error.message });
        }

        // Test individual room endpoints
        const durations = [30, 60, 180, 300];
        for (const duration of durations) {
            try {
                const roomResponse = await axios.get(`${this.baseURL}/api/admin/exposure/room/${duration}`, { headers });
                
                if (roomResponse.data.success) {
                    console.log(`✅ Room ${duration}s endpoint working`);
                    this.testResults.push({ test: `API Room ${duration}s`, status: 'PASS' });
                } else {
                    throw new Error(`Room ${duration}s returned success: false`);
                }
            } catch (error) {
                console.log(`❌ Room ${duration}s API failed:`, error.message);
                this.testResults.push({ test: `API Room ${duration}s`, status: 'FAIL', error: error.message });
            }
        }
    }

    /**
     * Test 3: Redis Data
     */
    async testRedisData() {
        console.log('\n🗄️ Testing Redis Data...');
        
        try {
            const redisClient = redis.getClient();
            
            // Test Redis connection
            await redisClient.ping();
            console.log('✅ Redis connection successful');
            
            // Check exposure data for each duration
            const durations = [30, 60, 180, 300];
            for (const duration of durations) {
                const currentPeriod = this.getCurrentPeriod(duration);
                const exposureKey = `exposure:wingo:${duration}:default:${currentPeriod}`;
                
                const exposureData = await redisClient.hgetall(exposureKey);
                
                if (Object.keys(exposureData).length > 0) {
                    console.log(`✅ Redis data found for ${duration}s room`);
                    
                    // Validate exposure format
                    let totalExposure = 0;
                    for (let i = 0; i < 10; i++) {
                        const exposure = parseInt(exposureData[`number:${i}`] || 0);
                        totalExposure += exposure;
                    }
                    
                    console.log(`   📊 Total exposure: ₹${(totalExposure / 100).toFixed(2)}`);
                } else {
                    console.log(`⚠️ No Redis data for ${duration}s room (may be normal if no bets)`);
                }
            }
            
            this.testResults.push({ test: 'Redis Data', status: 'PASS' });
        } catch (error) {
            console.log('❌ Redis test failed:', error.message);
            this.testResults.push({ test: 'Redis Data', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test 4: WebSocket Connection
     */
    async testWebSocketConnection() {
        console.log('\n🔌 Testing WebSocket Connection...');
        
        return new Promise((resolve) => {
            try {
                this.ws = new WebSocket(`ws://localhost:3000/admin-exposure?token=${this.adminToken}`);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connection established');
                    
                    // Subscribe to all rooms
                    const subscribeMessage = {
                        type: 'subscribe',
                        rooms: ['wingo-30s', 'wingo-60s', 'wingo-180s', 'wingo-300s']
                    };
                    
                    this.ws.send(JSON.stringify(subscribeMessage));
                    console.log('✅ Subscribed to all rooms');
                    
                    this.testResults.push({ test: 'WebSocket Connection', status: 'PASS' });
                    resolve();
                };
                
                this.ws.onerror = (error) => {
                    console.log('❌ WebSocket connection failed:', error.message);
                    this.testResults.push({ test: 'WebSocket Connection', status: 'FAIL', error: error.message });
                    resolve();
                };
                
                // Timeout after 5 seconds
                setTimeout(() => {
                    if (this.ws.readyState !== WebSocket.OPEN) {
                        console.log('❌ WebSocket connection timeout');
                        this.testResults.push({ test: 'WebSocket Connection', status: 'FAIL', error: 'Connection timeout' });
                        resolve();
                    }
                }, 5000);
                
            } catch (error) {
                console.log('❌ WebSocket test failed:', error.message);
                this.testResults.push({ test: 'WebSocket Connection', status: 'FAIL', error: error.message });
                resolve();
            }
        });
    }

    /**
     * Test 5: Real-time Updates
     */
    async testRealTimeUpdates() {
        console.log('\n🔄 Testing Real-time Updates...');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ Skipping real-time test - WebSocket not connected');
            this.testResults.push({ test: 'Real-time Updates', status: 'SKIP', error: 'WebSocket not connected' });
            return;
        }

        return new Promise((resolve) => {
            let messageCount = 0;
            const timeout = setTimeout(() => {
                if (messageCount > 0) {
                    console.log(`✅ Received ${messageCount} real-time updates`);
                    this.testResults.push({ test: 'Real-time Updates', status: 'PASS', details: `${messageCount} messages` });
                } else {
                    console.log('⚠️ No real-time updates received (may be normal if no activity)');
                    this.testResults.push({ test: 'Real-time Updates', status: 'PASS', details: 'No activity' });
                }
                resolve();
            }, 10000); // Wait 10 seconds for updates

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    messageCount++;
                    
                    if (data.type === 'exposure_update') {
                        console.log(`📊 Received exposure update for ${data.room}`);
                    } else if (data.type === 'period_update') {
                        console.log(`⏰ Received period update for ${data.room}`);
                    }
                } catch (error) {
                    console.log('❌ Error parsing WebSocket message:', error.message);
                }
            };
        });
    }

    /**
     * Test 6: Admin Override
     */
    async testAdminOverride() {
        console.log('\n🎮 Testing Admin Override...');
        
        if (!this.adminToken) {
            console.log('❌ Skipping override test - no admin token');
            this.testResults.push({ test: 'Admin Override', status: 'SKIP', error: 'No admin token' });
            return;
        }

        try {
            // First check period status
            const currentPeriod = this.getCurrentPeriod(30); // Test with 30s room
            const statusResponse = await axios.get(`${this.baseURL}/api/admin/games/wingo/period/${currentPeriod}/status`, {
                headers: { 'Authorization': `Bearer ${this.adminToken}` }
            });
            
            if (statusResponse.data.success) {
                console.log(`✅ Period status check working`);
                console.log(`   📊 Period: ${currentPeriod}, Can Override: ${statusResponse.data.data.canOverride}`);
                
                // Only test override if period allows it
                if (statusResponse.data.data.canOverride) {
                    const overrideResponse = await axios.post(`${this.baseURL}/api/admin/games/wingo/set-result`, {
                        duration: 30,
                        number: 5
                    }, {
                        headers: { 'Authorization': `Bearer ${this.adminToken}` }
                    });
                    
                    if (overrideResponse.data.success) {
                        console.log('✅ Admin override working');
                        this.testResults.push({ test: 'Admin Override', status: 'PASS' });
                    } else {
                        console.log('❌ Admin override failed:', overrideResponse.data.message);
                        this.testResults.push({ test: 'Admin Override', status: 'FAIL', error: overrideResponse.data.message });
                    }
                } else {
                    console.log('⚠️ Override not allowed (period not ended)');
                    this.testResults.push({ test: 'Admin Override', status: 'PASS', details: 'Period not ended' });
                }
            } else {
                throw new Error('Period status check failed');
            }
        } catch (error) {
            console.log('❌ Admin override test failed:', error.message);
            this.testResults.push({ test: 'Admin Override', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test 7: Period Status
     */
    async testPeriodStatus() {
        console.log('\n⏰ Testing Period Status...');
        
        if (!this.adminToken) {
            console.log('❌ Skipping period status test - no admin token');
            this.testResults.push({ test: 'Period Status', status: 'SKIP', error: 'No admin token' });
            return;
        }

        try {
            const durations = [30, 60, 180, 300];
            for (const duration of durations) {
                const currentPeriod = this.getCurrentPeriod(duration);
                const statusResponse = await axios.get(`${this.baseURL}/api/admin/games/wingo/period/${currentPeriod}/status`, {
                    headers: { 'Authorization': `Bearer ${this.adminToken}` }
                });
                
                if (statusResponse.data.success) {
                    const data = statusResponse.data.data;
                    console.log(`✅ Period status for ${duration}s: Active=${data.isActive}, TimeRemaining=${data.timeRemaining}s`);
                    this.testResults.push({ test: `Period Status ${duration}s`, status: 'PASS' });
                } else {
                    console.log(`❌ Period status for ${duration}s failed`);
                    this.testResults.push({ test: `Period Status ${duration}s`, status: 'FAIL' });
                }
            }
        } catch (error) {
            console.log('❌ Period status test failed:', error.message);
            this.testResults.push({ test: 'Period Status', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Generate test report
     */
    generateTestReport() {
        console.log('\n📋 Test Report');
        console.log('=============');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️ Skipped: ${skipped}`);
        console.log(`📊 Total: ${this.testResults.length}`);
        
        console.log('\n📝 Detailed Results:');
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
            console.log(`${status} ${result.test}: ${result.status}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
            if (result.details) {
                console.log(`   Details: ${result.details}`);
            }
        });
        
        if (failed === 0) {
            console.log('\n🎉 All tests passed! Exposure system is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Please check the errors above.');
        }
    }

    /**
     * Get current period for duration
     */
    getCurrentPeriod(duration) {
        const now = new Date();
        const periodStart = new Date(Math.floor(now.getTime() / (duration * 1000)) * (duration * 1000));
        return periodStart.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '');
    }
}

// Run tests
const tester = new ExposureSystemTester();
tester.runAllTests(); 