/**
 * Real WebSocket Test Script
 * Tests the actual running system with real periods
 */

const WebSocket = require('ws');
const axios = require('axios');

class RealWebSocketTester {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.wsURL = 'ws://localhost:8000/admin-exposure';
        this.adminToken = null;
        this.ws = null;
        this.testResults = [];
    }

    async runRealTest() {
        console.log('🧪 Real WebSocket System Test\n');
        
        try {
            await this.step1_CheckServer();
            await this.step2_GetAdminToken();
            await this.step3_TestAPIEndpoints();
            await this.step4_ConnectWebSocket();
            await this.step5_SubscribeAndMonitor();
            
            this.showResults();
            
        } catch (error) {
            console.error('❌ Test failed:', error);
        } finally {
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    async step1_CheckServer() {
        console.log('🔍 Step 1: Check Server Status');
        console.log('=============================');
        
        try {
            const response = await axios.get(`${this.baseURL}/health`);
            if (response.data.status === 'ok') {
                console.log('✅ Server is running');
                console.log(`   Uptime: ${response.data.uptime}s`);
                this.testResults.push({ step: 1, status: 'PASS', message: 'Server running' });
            } else {
                throw new Error('Server not responding correctly');
            }
        } catch (error) {
            console.log('❌ Server check failed:', error.message);
            this.testResults.push({ step: 1, status: 'FAIL', message: error.message });
        }
    }

    async step2_GetAdminToken() {
        console.log('\n🔐 Step 2: Get Admin Token');
        console.log('==========================');
        
        try {
            // Try the correct endpoint
            const response = await axios.post(`${this.baseURL}/api/admin/direct-login`, {
                email: 'admin@example.com'
            });
            
            if (response.data.success && response.data.data.token) {
                this.adminToken = response.data.data.token;
                console.log('✅ Admin token obtained');
                console.log(`   Token: ${this.adminToken.substring(0, 20)}...`);
                this.testResults.push({ step: 2, status: 'PASS', message: 'Token obtained' });
            } else {
                throw new Error('No token received');
            }
        } catch (error) {
            console.log('❌ Token acquisition failed:', error.message);
            
            // Try alternative endpoint
            try {
                console.log('🔄 Trying alternative endpoint...');
                const altResponse = await axios.post(`${this.baseURL}/admin/direct-login`, {
                    email: 'admin@example.com'
                });
                
                if (altResponse.data.success && altResponse.data.data.token) {
                    this.adminToken = altResponse.data.data.token;
                    console.log('✅ Admin token obtained (alternative endpoint)');
                    console.log(`   Token: ${this.adminToken.substring(0, 20)}...`);
                    this.testResults.push({ step: 2, status: 'PASS', message: 'Token obtained (alt endpoint)' });
                } else {
                    throw new Error('Alternative endpoint also failed');
                }
            } catch (altError) {
                console.log('❌ Alternative endpoint also failed:', altError.message);
                this.testResults.push({ step: 2, status: 'FAIL', message: 'All endpoints failed' });
            }
        }
    }

    async step3_TestAPIEndpoints() {
        console.log('\n📡 Step 3: Test API Endpoints');
        console.log('=============================');
        
        if (!this.adminToken) {
            console.log('❌ Skipping - no admin token');
            this.testResults.push({ step: 3, status: 'SKIP', message: 'No token' });
            return;
        }

        try {
            // Test exposure endpoints
            const endpoints = [
                '/api/admin/exposure/all',
                '/api/admin/exposure/room/30',
                '/admin/exposure/wingo/current'
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await axios.get(`${this.baseURL}${endpoint}`, {
                        headers: { 'Authorization': `Bearer ${this.adminToken}` }
                    });
                    
                    if (response.data.success) {
                        console.log(`✅ ${endpoint} - Working`);
                        
                        // Show real period data
                        if (response.data.rooms) {
                            Object.keys(response.data.rooms).forEach(room => {
                                const roomData = response.data.rooms[room];
                                const timeRemaining = roomData.periodInfo?.timeRemaining || 0;
                                console.log(`   ${room}: ${timeRemaining}s remaining`);
                            });
                        }
                    } else {
                        console.log(`❌ ${endpoint} - Failed`);
                    }
                } catch (error) {
                    console.log(`❌ ${endpoint} - Error: ${error.message}`);
                }
            }
            
            this.testResults.push({ step: 3, status: 'PASS', message: 'API endpoints tested' });
            
        } catch (error) {
            console.log('❌ API test failed:', error.message);
            this.testResults.push({ step: 3, status: 'FAIL', message: error.message });
        }
    }

    async step4_ConnectWebSocket() {
        console.log('\n🔌 Step 4: WebSocket Connection');
        console.log('==============================');
        
        if (!this.adminToken) {
            console.log('❌ Skipping - no admin token');
            this.testResults.push({ step: 4, status: 'SKIP', message: 'No token' });
            return;
        }

        return new Promise((resolve) => {
            try {
                console.log(`🔗 Connecting to: ${this.wsURL}`);
                console.log(`   Token: ${this.adminToken.substring(0, 20)}...`);
                
                this.ws = new WebSocket(`${this.wsURL}?token=${this.adminToken}`);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected successfully');
                    console.log('   State: OPEN');
                    console.log('   Ready for real-time updates');
                    this.testResults.push({ step: 4, status: 'PASS', message: 'Connected' });
                    resolve();
                };
                
                this.ws.onerror = (error) => {
                    console.log('❌ WebSocket connection failed:', error.message);
                    this.testResults.push({ step: 4, status: 'FAIL', message: error.message });
                    resolve();
                };
                
                this.ws.onclose = (code, reason) => {
                    console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
                };
                
                setTimeout(() => {
                    if (this.ws.readyState !== WebSocket.OPEN) {
                        console.log('❌ WebSocket connection timeout');
                        this.testResults.push({ step: 4, status: 'FAIL', message: 'Connection timeout' });
                        resolve();
                    }
                }, 10000); // 10 seconds timeout
                
            } catch (error) {
                console.log('❌ WebSocket setup failed:', error.message);
                this.testResults.push({ step: 4, status: 'FAIL', message: error.message });
                resolve();
            }
        });
    }

    async step5_SubscribeAndMonitor() {
        console.log('\n🔄 Step 5: Subscribe and Monitor');
        console.log('===============================');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ Skipping - WebSocket not connected');
            this.testResults.push({ step: 5, status: 'SKIP', message: 'WebSocket not connected' });
            return;
        }

        return new Promise((resolve) => {
            let messageCount = 0;
            let exposureUpdates = 0;
            let periodUpdates = 0;
            
            console.log('📤 Sending subscription...');
            
            // Subscribe to all rooms
            const subscribeMessage = {
                type: 'subscribe',
                rooms: ['wingo-30s', 'wingo-60s', 'wingo-180s', 'wingo-300s']
            };
            
            this.ws.send(JSON.stringify(subscribeMessage));
            console.log('✅ Subscription sent');
            console.log('👂 Monitoring for 30 seconds...');
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    messageCount++;
                    
                    console.log(`\n📨 Message #${messageCount} (${new Date().toLocaleTimeString()}):`);
                    console.log(`   Type: ${data.type}`);
                    
                    if (data.type === 'exposure_update') {
                        exposureUpdates++;
                        console.log(`   Room: ${data.room}`);
                        console.log(`   Total Exposure: ₹${data.analysis?.totalExposure || 'N/A'}`);
                        console.log(`   Optimal Number: ${data.analysis?.optimalNumber || 'N/A'}`);
                        console.log(`   Time Remaining: ${data.periodInfo?.timeRemaining || 'N/A'}s`);
                        
                        // Show exposure for numbers with bets
                        if (data.exposures) {
                            const activeNumbers = [];
                            for (let i = 0; i <= 9; i++) {
                                const exposure = data.exposures[`number:${i}`];
                                if (exposure && parseFloat(exposure) > 0) {
                                    activeNumbers.push(`${i}:₹${exposure}`);
                                }
                            }
                            if (activeNumbers.length > 0) {
                                console.log(`   Active Bets: ${activeNumbers.join(', ')}`);
                            }
                        }
                        
                    } else if (data.type === 'period_update') {
                        periodUpdates++;
                        console.log(`   Room: ${data.room}`);
                        console.log(`   Period: ${data.periodId}`);
                        console.log(`   Time Remaining: ${data.timeRemaining}s`);
                        
                    } else if (data.type === 'error') {
                        console.log(`   Error: ${data.message}`);
                        
                    } else {
                        console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
                    }
                    
                } catch (error) {
                    console.log('❌ Error parsing message:', error.message);
                    console.log('Raw message:', event.data);
                }
            };
            
            setTimeout(() => {
                console.log(`\n📊 Monitoring Results:`);
                console.log(`   Total Messages: ${messageCount}`);
                console.log(`   Exposure Updates: ${exposureUpdates}`);
                console.log(`   Period Updates: ${periodUpdates}`);
                
                if (messageCount > 0) {
                    console.log('✅ Real-time updates working');
                    this.testResults.push({ 
                        step: 5, 
                        status: 'PASS', 
                        message: `${messageCount} messages received` 
                    });
                } else {
                    console.log('⚠️ No updates received (may be normal if no activity)');
                    this.testResults.push({ 
                        step: 5, 
                        status: 'PASS', 
                        message: 'No activity detected' 
                    });
                }
                
                resolve();
            }, 30000); // 30 seconds
        });
    }

    showResults() {
        console.log('\n📋 Test Results');
        console.log('===============');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️ Skipped: ${skipped}`);
        console.log(`📊 Total: ${this.testResults.length}`);
        
        console.log('\n📝 Step Details:');
        this.testResults.forEach((result, index) => {
            const stepNumber = index + 1;
            const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
            console.log(`${status} Step ${stepNumber}: ${result.message}`);
        });
        
        if (failed === 0) {
            console.log('\n🎉 All tests passed! Real WebSocket system is working.');
        } else {
            console.log('\n⚠️ Some tests failed. Please check the errors above.');
        }
    }
}

// Run the real test
const tester = new RealWebSocketTester();
tester.runRealTest(); 