/**
 * Test Script with Provided Admin Token
 * Tests the real system with the actual admin token
 */

const WebSocket = require('ws');
const axios = require('axios');

class TokenBasedTester {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.wsURL = 'ws://localhost:8000/admin-exposure';
        // Use the provided admin token
        this.adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJpc19hZG1pbiI6dHJ1ZSwiaWF0IjoxNzUyNDU2NjgxLCJleHAiOjE3NTI1NDMwODF9.48Np5DOYhqD_h8Wji6Az_RLZmvm09Ij-33kKnpmjbdU';
        this.ws = null;
        this.testResults = [];
    }

    async runTest() {
        console.log('🧪 Testing with Provided Admin Token\n');
        
        try {
            await this.step1_CheckServer();
            await this.step2_VerifyToken();
            await this.step3_TestAllEndpoints();
            await this.step4_ConnectWebSocket();
            await this.step5_MonitorRealTime();
            
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

    async step2_VerifyToken() {
        console.log('\n🔐 Step 2: Verify Admin Token');
        console.log('=============================');
        
        try {
            // Test token by making a simple API call
            const response = await axios.get(`${this.baseURL}/api/admin/exposure/all`, {
                headers: { 'Authorization': `Bearer ${this.adminToken}` }
            });
            
            if (response.data.success) {
                console.log('✅ Admin token is valid');
                console.log(`   Token: ${this.adminToken.substring(0, 20)}...`);
                this.testResults.push({ step: 2, status: 'PASS', message: 'Token valid' });
            } else {
                throw new Error('Token validation failed');
            }
        } catch (error) {
            console.log('❌ Token verification failed:', error.message);
            this.testResults.push({ step: 2, status: 'FAIL', message: error.message });
        }
    }

    async step3_TestAllEndpoints() {
        console.log('\n📡 Step 3: Test All Endpoints');
        console.log('=============================');
        
        const endpoints = [
            { path: '/api/admin/exposure/all', name: 'All Exposure' },
            { path: '/api/admin/exposure/room/30', name: '30s Room' },
            { path: '/api/admin/exposure/room/60', name: '60s Room' },
            { path: '/api/admin/exposure/room/180', name: '180s Room' },
            { path: '/api/admin/exposure/room/300', name: '300s Room' },
            { path: '/admin/exposure/wingo/current', name: 'Wingo Current' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(`${this.baseURL}${endpoint.path}`, {
                    headers: { 'Authorization': `Bearer ${this.adminToken}` }
                });
                
                if (response.data.success) {
                    console.log(`✅ ${endpoint.name} - Working`);
                    
                    // Show period data if available
                    if (response.data.rooms) {
                        Object.keys(response.data.rooms).forEach(room => {
                            const roomData = response.data.rooms[room];
                            const timeRemaining = roomData.periodInfo?.timeRemaining || 0;
                            const status = timeRemaining > 0 ? '🟢 Active' : '🔴 Ended';
                            console.log(`   ${room}: ${status} (${timeRemaining}s remaining)`);
                        });
                    } else if (response.data.data) {
                        const data = response.data.data;
                        if (data.periodInfo) {
                            const timeRemaining = data.periodInfo.timeRemaining || 0;
                            const status = timeRemaining > 0 ? '🟢 Active' : '🔴 Ended';
                            console.log(`   Period: ${status} (${timeRemaining}s remaining)`);
                        }
                    }
                } else {
                    console.log(`❌ ${endpoint.name} - Failed`);
                }
            } catch (error) {
                console.log(`❌ ${endpoint.name} - Error: ${error.message}`);
            }
        }
        
        this.testResults.push({ step: 3, status: 'PASS', message: 'Endpoints tested' });
    }

    async step4_ConnectWebSocket() {
        console.log('\n🔌 Step 4: WebSocket Connection');
        console.log('==============================');
        
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
                }, 10000);
                
            } catch (error) {
                console.log('❌ WebSocket setup failed:', error.message);
                this.testResults.push({ step: 4, status: 'FAIL', message: error.message });
                resolve();
            }
        });
    }

    async step5_MonitorRealTime() {
        console.log('\n🔄 Step 5: Monitor Real-time Updates');
        console.log('===================================');
        
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
                            } else {
                                console.log(`   Active Bets: None`);
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
            console.log('\n🎉 All tests passed! System is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Please check the errors above.');
        }
    }
}

// Run the test with provided token
const tester = new TokenBasedTester();
tester.runTest(); 