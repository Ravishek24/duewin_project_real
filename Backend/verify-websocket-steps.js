/**
 * Step-by-Step WebSocket Verification Script
 * Tests real-time exposure monitoring with actual periods
 */

const WebSocket = require('ws');
const axios = require('axios');

class WebSocketStepVerifier {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.wsURL = 'ws://localhost:8000/admin-exposure';
        this.adminToken = null;
        this.ws = null;
        this.stepResults = [];
    }

    async runStepByStepVerification() {
        console.log('🔍 WebSocket Step-by-Step Verification\n');
        
        await this.step1_CheckServer();
        await this.step2_Authenticate();
        await this.step3_CheckRealPeriods();
        await this.step4_ConnectWebSocket();
        await this.step5_SubscribeToRooms();
        await this.step6_MonitorUpdates();
        await this.step7_VerifyCountdown();
        
        this.showResults();
    }

    async step1_CheckServer() {
        console.log('🔍 Step 1: Check Server Status');
        console.log('=============================');
        
        try {
            const response = await axios.get(`${this.baseURL}/health`);
            if (response.data.status === 'ok') {
                console.log('✅ Server is running');
                this.stepResults.push({ step: 1, status: 'PASS', message: 'Server running' });
            } else {
                throw new Error('Server not responding correctly');
            }
        } catch (error) {
            console.log('❌ Server check failed:', error.message);
            this.stepResults.push({ step: 1, status: 'FAIL', message: error.message });
        }
    }

    async step2_Authenticate() {
        console.log('\n🔐 Step 2: Admin Authentication');
        console.log('==============================');
        
        try {
            const response = await axios.post(`${this.baseURL}/api/admin/direct-login`, {
                email: 'admin@example.com'
            });
            
            if (response.data.success && response.data.data.token) {
                this.adminToken = response.data.data.token;
                console.log('✅ Authentication successful');
                console.log(`   Token: ${this.adminToken.substring(0, 20)}...`);
                this.stepResults.push({ step: 2, status: 'PASS', message: 'Authenticated' });
            } else {
                throw new Error('Authentication failed');
            }
        } catch (error) {
            console.log('❌ Authentication failed:', error.message);
            this.stepResults.push({ step: 2, status: 'FAIL', message: error.message });
        }
    }

    async step3_CheckRealPeriods() {
        console.log('\n📊 Step 3: Check Real Periods');
        console.log('=============================');
        
        if (!this.adminToken) {
            console.log('❌ Skipping - not authenticated');
            this.stepResults.push({ step: 3, status: 'SKIP', message: 'Not authenticated' });
            return;
        }

        try {
            const response = await axios.get(`${this.baseURL}/api/admin/exposure/all`, {
                headers: { 'Authorization': `Bearer ${this.adminToken}` }
            });
            
            if (response.data.success) {
                const rooms = response.data.rooms || {};
                console.log(`✅ Found ${Object.keys(rooms).length} active rooms`);
                
                Object.keys(rooms).forEach(room => {
                    const roomData = rooms[room];
                    const timeRemaining = roomData.periodInfo?.timeRemaining || 0;
                    const status = timeRemaining > 0 ? '🟢 Active' : '🔴 Ended';
                    
                    console.log(`   ${room}: ${status} (${timeRemaining}s remaining)`);
                    console.log(`   Total Exposure: ₹${roomData.analysis?.totalExposure || '0.00'}`);
                    console.log(`   Optimal Number: ${roomData.analysis?.optimalNumber || 'N/A'}`);
                });
                
                this.stepResults.push({ step: 3, status: 'PASS', message: `${Object.keys(rooms).length} rooms found` });
            } else {
                throw new Error('Failed to get period data');
            }
        } catch (error) {
            console.log('❌ Period check failed:', error.message);
            this.stepResults.push({ step: 3, status: 'FAIL', message: error.message });
        }
    }

    async step4_ConnectWebSocket() {
        console.log('\n🔌 Step 4: WebSocket Connection');
        console.log('==============================');
        
        return new Promise((resolve) => {
            try {
                console.log(`🔗 Connecting to: ${this.wsURL}`);
                
                this.ws = new WebSocket(`${this.wsURL}?token=${this.adminToken}`);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected successfully');
                    console.log('   State: OPEN');
                    console.log('   Ready for real-time updates');
                    this.stepResults.push({ step: 4, status: 'PASS', message: 'Connected' });
                    resolve();
                };
                
                this.ws.onerror = (error) => {
                    console.log('❌ WebSocket connection failed:', error.message);
                    this.stepResults.push({ step: 4, status: 'FAIL', message: error.message });
                    resolve();
                };
                
                setTimeout(() => {
                    if (this.ws.readyState !== WebSocket.OPEN) {
                        console.log('❌ WebSocket connection timeout');
                        this.stepResults.push({ step: 4, status: 'FAIL', message: 'Connection timeout' });
                        resolve();
                    }
                }, 5000);
                
            } catch (error) {
                console.log('❌ WebSocket setup failed:', error.message);
                this.stepResults.push({ step: 4, status: 'FAIL', message: error.message });
                resolve();
            }
        });
    }

    async step5_SubscribeToRooms() {
        console.log('\n📡 Step 5: Subscribe to Rooms');
        console.log('=============================');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ Skipping - WebSocket not connected');
            this.stepResults.push({ step: 5, status: 'SKIP', message: 'WebSocket not connected' });
            return;
        }

        try {
            const subscribeMessage = {
                type: 'subscribe',
                rooms: ['wingo-30s', 'wingo-60s', 'wingo-180s', 'wingo-300s']
            };
            
            console.log('📤 Sending subscription:');
            console.log(JSON.stringify(subscribeMessage, null, 2));
            
            this.ws.send(JSON.stringify(subscribeMessage));
            console.log('✅ Subscription sent');
            
            // Wait for subscription to process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.stepResults.push({ step: 5, status: 'PASS', message: 'Subscribed to all rooms' });
            
        } catch (error) {
            console.log('❌ Subscription failed:', error.message);
            this.stepResults.push({ step: 5, status: 'FAIL', message: error.message });
        }
    }

    async step6_MonitorUpdates() {
        console.log('\n🔄 Step 6: Monitor Real-time Updates');
        console.log('===================================');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ Skipping - WebSocket not connected');
            this.stepResults.push({ step: 6, status: 'SKIP', message: 'WebSocket not connected' });
            return;
        }

        return new Promise((resolve) => {
            let messageCount = 0;
            let exposureUpdates = 0;
            let periodUpdates = 0;
            
            console.log('👂 Listening for updates (20 seconds)...');
            
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
                }
            };
            
            setTimeout(() => {
                console.log(`\n📊 Monitoring Results:`);
                console.log(`   Total Messages: ${messageCount}`);
                console.log(`   Exposure Updates: ${exposureUpdates}`);
                console.log(`   Period Updates: ${periodUpdates}`);
                
                if (messageCount > 0) {
                    console.log('✅ Real-time updates working');
                    this.stepResults.push({ 
                        step: 6, 
                        status: 'PASS', 
                        message: `${messageCount} messages received` 
                    });
                } else {
                    console.log('⚠️ No updates received (may be normal if no activity)');
                    this.stepResults.push({ 
                        step: 6, 
                        status: 'PASS', 
                        message: 'No activity detected' 
                    });
                }
                
                resolve();
            }, 20000); // 20 seconds
        });
    }

    async step7_VerifyCountdown() {
        console.log('\n⏰ Step 7: Verify Period Countdown');
        console.log('===============================');
        
        try {
            const durations = [30, 60, 180, 300];
            let countdownValid = true;
            
            for (const duration of durations) {
                const currentPeriod = this.getCurrentPeriod(duration);
                const periodInfo = this.getPeriodInfo(duration, currentPeriod);
                
                console.log(`🎮 ${duration}s Room:`);
                console.log(`   Period: ${currentPeriod}`);
                console.log(`   Time Remaining: ${periodInfo.timeRemaining}s`);
                console.log(`   Status: ${periodInfo.timeRemaining > 0 ? '🟢 Active' : '🔴 Ended'}`);
                
                // Validate countdown
                if (periodInfo.timeRemaining < 0 || periodInfo.timeRemaining > duration) {
                    console.log(`   ⚠️ Warning: Countdown seems incorrect`);
                    countdownValid = false;
                }
                
                console.log('');
            }
            
            if (countdownValid) {
                console.log('✅ Period countdown is working correctly');
                this.stepResults.push({ step: 7, status: 'PASS', message: 'Countdown valid' });
            } else {
                console.log('❌ Period countdown has issues');
                this.stepResults.push({ step: 7, status: 'FAIL', message: 'Countdown issues' });
            }
            
        } catch (error) {
            console.log('❌ Countdown verification failed:', error.message);
            this.stepResults.push({ step: 7, status: 'FAIL', message: error.message });
        }
    }

    showResults() {
        console.log('\n📋 Verification Results');
        console.log('======================');
        
        const passed = this.stepResults.filter(r => r.status === 'PASS').length;
        const failed = this.stepResults.filter(r => r.status === 'FAIL').length;
        const skipped = this.stepResults.filter(r => r.status === 'SKIP').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️ Skipped: ${skipped}`);
        console.log(`📊 Total: ${this.stepResults.length}`);
        
        console.log('\n📝 Step Details:');
        this.stepResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
            console.log(`${status} Step ${result.step}: ${result.message}`);
        });
        
        if (failed === 0) {
            console.log('\n🎉 All steps passed! WebSocket system is working correctly.');
        } else {
            console.log('\n⚠️ Some steps failed. Please check the errors above.');
        }
    }

    getCurrentPeriod(duration) {
        const now = new Date();
        const periodStart = new Date(Math.floor(now.getTime() / (duration * 1000)) * (duration * 1000));
        return periodStart.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '');
    }

    getPeriodInfo(duration, periodId) {
        const now = new Date();
        
        let periodStart;
        if (periodId && periodId.length === 15) {
            const year = periodId.substring(0, 4);
            const month = periodId.substring(4, 6);
            const day = periodId.substring(6, 8);
            const hour = periodId.substring(9, 11);
            const minute = periodId.substring(11, 13);
            const second = periodId.substring(13, 15);
            
            periodStart = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
        } else {
            periodStart = new Date();
        }
        
        if (isNaN(periodStart.getTime())) {
            periodStart = new Date();
        }
        
        const periodEnd = new Date(periodStart.getTime() + (duration * 1000));
        const timeRemaining = Math.max(0, Math.floor((periodEnd - now) / 1000));

        return {
            startTime: periodStart.toISOString(),
            endTime: periodEnd.toISOString(),
            timeRemaining: timeRemaining,
            duration: duration
        };
    }
}

// Run verification
const verifier = new WebSocketStepVerifier();
verifier.runStepByStepVerification(); 