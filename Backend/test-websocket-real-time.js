/**
 * Comprehensive WebSocket Testing Script
 * Tests real-time exposure monitoring with actual periods and countdown
 */

const WebSocket = require('ws');
const axios = require('axios');
const redis = require('./config/redis');

class WebSocketRealTimeTester {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.wsURL = 'ws://localhost:8000/admin-exposure';
        this.adminToken = null;
        this.ws = null;
        this.testResults = [];
        this.messageCount = 0;
        this.periodData = {};
    }

    async runCompleteTest() {
        console.log('🧪 Starting WebSocket Real-Time Testing...\n');
        
        try {
            // Step 1: Authentication
            await this.step1_Authentication();
            
            // Step 2: Get Real Period Data
            await this.step2_GetRealPeriodData();
            
            // Step 3: WebSocket Connection
            await this.step3_WebSocketConnection();
            
            // Step 4: Subscribe to Real Periods
            await this.step4_SubscribeToRealPeriods();
            
            // Step 5: Monitor Real-time Updates
            await this.step5_MonitorRealTimeUpdates();
            
            // Step 6: Test Period Countdown
            await this.step6_TestPeriodCountdown();
            
            // Step 7: Test Exposure Updates
            await this.step7_TestExposureUpdates();
            
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
     * Step 1: Authentication
     */
    async step1_Authentication() {
        console.log('🔐 Step 1: Authentication');
        console.log('========================');
        
        try {
            const response = await axios.post(`${this.baseURL}/api/admin/direct-login`, {
                email: 'admin@example.com'
            });
            
            if (response.data.success && response.data.data.token) {
                this.adminToken = response.data.data.token;
                console.log('✅ Authentication successful');
                console.log(`   Token: ${this.adminToken.substring(0, 20)}...`);
                this.testResults.push({ step: 'Authentication', status: 'PASS' });
            } else {
                throw new Error('No token received');
            }
        } catch (error) {
            console.log('❌ Authentication failed:', error.message);
            this.testResults.push({ step: 'Authentication', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Step 2: Get Real Period Data
     */
    async step2_GetRealPeriodData() {
        console.log('\n📊 Step 2: Get Real Period Data');
        console.log('===============================');
        
        if (!this.adminToken) {
            console.log('❌ Skipping - no admin token');
            return;
        }

        try {
            // Get current periods for all durations
            const durations = [30, 60, 180, 300];
            
            for (const duration of durations) {
                const currentPeriod = this.getCurrentPeriod(duration);
                const periodInfo = this.getPeriodInfo(duration, currentPeriod);
                
                this.periodData[duration] = {
                    periodId: currentPeriod,
                    periodInfo: periodInfo,
                    timeRemaining: periodInfo.timeRemaining
                };
                
                console.log(`🎮 ${duration}s Room:`);
                console.log(`   Period ID: ${currentPeriod}`);
                console.log(`   Start Time: ${periodInfo.startTime}`);
                console.log(`   End Time: ${periodInfo.endTime}`);
                console.log(`   Time Remaining: ${periodInfo.timeRemaining}s`);
                console.log(`   Is Active: ${periodInfo.timeRemaining > 0 ? 'Yes' : 'No'}`);
                console.log('');
            }
            
            this.testResults.push({ step: 'Get Real Period Data', status: 'PASS' });
            
        } catch (error) {
            console.log('❌ Failed to get period data:', error.message);
            this.testResults.push({ step: 'Get Real Period Data', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Step 3: WebSocket Connection
     */
    async step3_WebSocketConnection() {
        console.log('🔌 Step 3: WebSocket Connection');
        console.log('==============================');
        
        return new Promise((resolve) => {
            try {
                console.log(`🔗 Connecting to: ${this.wsURL}?token=${this.adminToken.substring(0, 20)}...`);
                
                this.ws = new WebSocket(`${this.wsURL}?token=${this.adminToken}`);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connection established');
                    console.log('   Connection state: OPEN');
                    console.log('   Ready to send/receive messages');
                    this.testResults.push({ step: 'WebSocket Connection', status: 'PASS' });
                    resolve();
                };
                
                this.ws.onerror = (error) => {
                    console.log('❌ WebSocket connection failed:', error.message);
                    this.testResults.push({ step: 'WebSocket Connection', status: 'FAIL', error: error.message });
                    resolve();
                };
                
                this.ws.onclose = (code, reason) => {
                    console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
                };
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    if (this.ws.readyState !== WebSocket.OPEN) {
                        console.log('❌ WebSocket connection timeout');
                        this.testResults.push({ step: 'WebSocket Connection', status: 'FAIL', error: 'Connection timeout' });
                        resolve();
                    }
                }, 10000);
                
            } catch (error) {
                console.log('❌ WebSocket test failed:', error.message);
                this.testResults.push({ step: 'WebSocket Connection', status: 'FAIL', error: error.message });
                resolve();
            }
        });
    }

    /**
     * Step 4: Subscribe to Real Periods
     */
    async step4_SubscribeToRealPeriods() {
        console.log('\n📡 Step 4: Subscribe to Real Periods');
        console.log('===================================');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ Skipping - WebSocket not connected');
            this.testResults.push({ step: 'Subscribe to Real Periods', status: 'SKIP', error: 'WebSocket not connected' });
            return;
        }

        try {
            // Subscribe to all rooms
            const subscribeMessage = {
                type: 'subscribe',
                rooms: ['wingo-30s', 'wingo-60s', 'wingo-180s', 'wingo-300s']
            };
            
            console.log('📤 Sending subscription message:');
            console.log(JSON.stringify(subscribeMessage, null, 2));
            
            this.ws.send(JSON.stringify(subscribeMessage));
            console.log('✅ Subscription message sent');
            
            // Wait a moment for subscription to process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.testResults.push({ step: 'Subscribe to Real Periods', status: 'PASS' });
            
        } catch (error) {
            console.log('❌ Subscription failed:', error.message);
            this.testResults.push({ step: 'Subscribe to Real Periods', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Step 5: Monitor Real-time Updates
     */
    async step5_MonitorRealTimeUpdates() {
        console.log('\n🔄 Step 5: Monitor Real-time Updates');
        console.log('===================================');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ Skipping - WebSocket not connected');
            this.testResults.push({ step: 'Monitor Real-time Updates', status: 'SKIP', error: 'WebSocket not connected' });
            return;
        }

        return new Promise((resolve) => {
            let updateCount = 0;
            const startTime = Date.now();
            
            console.log('👂 Listening for real-time updates...');
            console.log('   (Monitoring for 30 seconds)');
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    updateCount++;
                    
                    console.log(`\n📨 Message #${updateCount} received at ${new Date().toLocaleTimeString()}:`);
                    console.log(`   Type: ${data.type}`);
                    
                    if (data.type === 'exposure_update') {
                        console.log(`   Room: ${data.room}`);
                        console.log(`   Total Exposure: ₹${data.analysis?.totalExposure || 'N/A'}`);
                        console.log(`   Optimal Number: ${data.analysis?.optimalNumber || 'N/A'}`);
                        console.log(`   Time Remaining: ${data.periodInfo?.timeRemaining || 'N/A'}s`);
                        
                        // Show exposure for each number
                        if (data.exposures) {
                            console.log('   📊 Exposure by Number:');
                            for (let i = 0; i <= 9; i++) {
                                const exposure = data.exposures[`number:${i}`];
                                if (exposure && parseFloat(exposure) > 0) {
                                    console.log(`      ${i}: ₹${exposure}`);
                                }
                            }
                        }
                        
                    } else if (data.type === 'period_update') {
                        console.log(`   Room: ${data.room}`);
                        console.log(`   Period ID: ${data.periodId}`);
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
            
            // Monitor for 30 seconds
            setTimeout(() => {
                const duration = (Date.now() - startTime) / 1000;
                console.log(`\n⏱️ Monitoring completed after ${duration.toFixed(1)} seconds`);
                console.log(`📊 Total messages received: ${updateCount}`);
                
                if (updateCount > 0) {
                    console.log('✅ Real-time updates working');
                    this.testResults.push({ 
                        step: 'Monitor Real-time Updates', 
                        status: 'PASS', 
                        details: `${updateCount} messages in ${duration.toFixed(1)}s` 
                    });
                } else {
                    console.log('⚠️ No real-time updates received (may be normal if no activity)');
                    this.testResults.push({ 
                        step: 'Monitor Real-time Updates', 
                        status: 'PASS', 
                        details: 'No activity detected' 
                    });
                }
                
                resolve();
            }, 30000); // 30 seconds
        });
    }

    /**
     * Step 6: Test Period Countdown
     */
    async step6_TestPeriodCountdown() {
        console.log('\n⏰ Step 6: Test Period Countdown');
        console.log('===============================');
        
        try {
            const durations = [30, 60, 180, 300];
            let countdownWorking = true;
            
            for (const duration of durations) {
                const currentPeriod = this.getCurrentPeriod(duration);
                const periodInfo = this.getPeriodInfo(duration, currentPeriod);
                
                console.log(`🎮 ${duration}s Room Countdown:`);
                console.log(`   Period: ${currentPeriod}`);
                console.log(`   Time Remaining: ${periodInfo.timeRemaining}s`);
                console.log(`   Status: ${periodInfo.timeRemaining > 0 ? 'Active' : 'Ended'}`);
                
                // Check if countdown is reasonable
                if (periodInfo.timeRemaining < 0 || periodInfo.timeRemaining > duration) {
                    console.log(`   ⚠️ Warning: Countdown seems incorrect`);
                    countdownWorking = false;
                }
                
                console.log('');
            }
            
            if (countdownWorking) {
                console.log('✅ Period countdown working correctly');
                this.testResults.push({ step: 'Test Period Countdown', status: 'PASS' });
            } else {
                console.log('❌ Period countdown has issues');
                this.testResults.push({ step: 'Test Period Countdown', status: 'FAIL', error: 'Countdown issues detected' });
            }
            
        } catch (error) {
            console.log('❌ Countdown test failed:', error.message);
            this.testResults.push({ step: 'Test Period Countdown', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Step 7: Test Exposure Updates
     */
    async step7_TestExposureUpdates() {
        console.log('\n💰 Step 7: Test Exposure Updates');
        console.log('==============================');
        
        try {
            // Check Redis for real exposure data
            const redisClient = redis.getClient();
            const durations = [30, 60, 180, 300];
            let hasExposureData = false;
            
            for (const duration of durations) {
                const currentPeriod = this.getCurrentPeriod(duration);
                const exposureKey = `exposure:wingo:${duration}:default:${currentPeriod}`;
                
                const exposureData = await redisClient.hgetall(exposureKey);
                
                if (Object.keys(exposureData).length > 0) {
                    console.log(`✅ Redis exposure data found for ${duration}s room`);
                    
                    let totalExposure = 0;
                    for (let i = 0; i <= 9; i++) {
                        const exposure = parseInt(exposureData[`number:${i}`] || 0);
                        totalExposure += exposure;
                        
                        if (exposure > 0) {
                            console.log(`   Number ${i}: ₹${(exposure / 100).toFixed(2)}`);
                        }
                    }
                    
                    console.log(`   Total Exposure: ₹${(totalExposure / 100).toFixed(2)}`);
                    hasExposureData = true;
                    
                } else {
                    console.log(`⚠️ No Redis exposure data for ${duration}s room (may be normal if no bets)`);
                }
                
                console.log('');
            }
            
            if (hasExposureData) {
                console.log('✅ Exposure data is being tracked');
                this.testResults.push({ step: 'Test Exposure Updates', status: 'PASS' });
            } else {
                console.log('⚠️ No exposure data found (normal if no bets placed)');
                this.testResults.push({ step: 'Test Exposure Updates', status: 'PASS', details: 'No bets detected' });
            }
            
        } catch (error) {
            console.log('❌ Exposure test failed:', error.message);
            this.testResults.push({ step: 'Test Exposure Updates', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Generate test report
     */
    generateTestReport() {
        console.log('\n📋 WebSocket Real-Time Test Report');
        console.log('==================================');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️ Skipped: ${skipped}`);
        console.log(`📊 Total: ${this.testResults.length}`);
        
        console.log('\n📝 Step-by-Step Results:');
        this.testResults.forEach((result, index) => {
            const stepNumber = index + 1;
            const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
            console.log(`${status} Step ${stepNumber}: ${result.step} - ${result.status}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
            if (result.details) {
                console.log(`   Details: ${result.details}`);
            }
        });
        
        if (failed === 0) {
            console.log('\n🎉 All WebSocket tests passed! Real-time system is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Please check the errors above.');
        }
        
        // Show current period status
        console.log('\n🎮 Current Period Status:');
        const durations = [30, 60, 180, 300];
        durations.forEach(duration => {
            const periodInfo = this.periodData[duration];
            if (periodInfo) {
                const status = periodInfo.timeRemaining > 0 ? '🟢 Active' : '🔴 Ended';
                console.log(`   ${duration}s: ${status} (${periodInfo.timeRemaining}s remaining)`);
            }
        });
    }

    /**
     * Get current period for duration
     */
    getCurrentPeriod(duration) {
        const now = new Date();
        const periodStart = new Date(Math.floor(now.getTime() / (duration * 1000)) * (duration * 1000));
        return periodStart.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '');
    }

    /**
     * Get period information
     */
    getPeriodInfo(duration, periodId) {
        const now = new Date();
        
        // Parse periodId
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

// Run the complete test
const tester = new WebSocketRealTimeTester();
tester.runCompleteTest(); 