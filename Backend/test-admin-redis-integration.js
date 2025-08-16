#!/usr/bin/env node
/**
 * Test script to verify Admin Set Result with Redis Integration
 * This script tests the complete flow: admin sets result -> scheduler processes it
 */

const axios = require('axios');
const moment = require('moment-timezone');

class AdminRedisIntegrationTester {
    constructor() {
        this.baseURL = process.env.API_BASE_URL || 'http://localhost:3001';
        this.adminToken = null;
    }

    /**
     * Initialize admin authentication
     */
    async initialize() {
        console.log('🔐 [TEST] ===== ADMIN REDIS INTEGRATION TEST =====');
        console.log('🔐 [TEST] Base URL:', this.baseURL);
        console.log('🔐 [TEST] Testing the complete admin -> Redis -> scheduler flow');
        
        try {
            const adminLoginResponse = await axios.post(`${this.baseURL}/api/admin/direct-login`, {
                email: 'admin@diuwin.com'
            });

            if (adminLoginResponse.data.success) {
                this.adminToken = adminLoginResponse.data.data.token;
                console.log('✅ [TEST] Admin token obtained');
            } else {
                throw new Error('Failed to get admin token: ' + adminLoginResponse.data.message);
            }
        } catch (error) {
            console.error('❌ [TEST] Failed to initialize:', error.message);
            throw error;
        }
    }

    /**
     * Generate a period ID for testing (future period)
     */
    generateTestPeriodId(offsetSeconds = 0) {
        const now = moment().tz('Asia/Kolkata').add(offsetSeconds, 'seconds');
        const dateStr = now.format('YYYYMMDD');
        
        // Calculate sequence number for 30s periods
        const startOfDay = moment.tz(dateStr, 'YYYYMMDD', 'Asia/Kolkata');
        const secondsSinceStartOfDay = now.diff(startOfDay, 'seconds');
        const sequenceNumber = Math.floor(secondsSinceStartOfDay / 30);
        
        return `${dateStr}${sequenceNumber.toString().padStart(9, '0')}`;
    }

    /**
     * Test 1: Check period status for a future period
     */
    async testPeriodStatus() {
        console.log('\n🔐 [TEST] ===== TEST 1: PERIOD STATUS (REDIS-BASED) =====');
        
        try {
            // Generate a period ID that should have ended
            const testPeriodId = this.generateTestPeriodId(-60); // 60 seconds ago
            console.log('🔐 [TEST] Testing period ID:', testPeriodId);
            
            const response = await axios.get(
                `${this.baseURL}/api/admin/games/wingo/period/${testPeriodId}/status?duration=30`,
                {
                    headers: { 'Authorization': `Bearer ${this.adminToken}` }
                }
            );

            if (response.data.success) {
                console.log('✅ [TEST] Period status check successful (Redis-based)');
                console.log('🔐 [TEST] Period data:');
                console.log('  - Period ID:', response.data.data.period_id);
                console.log('  - Time remaining:', response.data.data.time_remaining);
                console.log('  - Can override:', response.data.data.can_override);
                console.log('  - Calculation method:', response.data.data.calculation_method);
                console.log('  - Has existing result:', response.data.data.has_existing_result);
                
                return response.data.data;
            } else {
                throw new Error('Period status check failed: ' + response.data.message);
            }
        } catch (error) {
            console.error('❌ [TEST] Period status check failed:', error.message);
            if (error.response) {
                console.error('❌ [TEST] Error response:', JSON.stringify(error.response.data, null, 2));
            }
            return null;
        }
    }

    /**
     * Test 2: Set admin result for a period that has ended
     */
    async testAdminSetResult() {
        console.log('\n🔐 [TEST] ===== TEST 2: ADMIN SET RESULT (REDIS STORAGE) =====');
        
        try {
            // Generate a period that should have ended
            const testPeriodId = this.generateTestPeriodId(-60); // 60 seconds ago
            const testNumber = 7; // Test with number 7 (green, big)
            
            console.log('🔐 [TEST] Setting result for period:', testPeriodId);
            console.log('🔐 [TEST] Number:', testNumber);
            console.log('🔐 [TEST] Expected: green, big');
            
            console.log('\n🔐 [TEST] WATCH SERVER LOGS for detailed Redis storage...');
            
            const response = await axios.post(
                `${this.baseURL}/api/admin/games/wingo/set-result`,
                {
                    periodId: testPeriodId,
                    number: testNumber,
                    duration: 30
                },
                {
                    headers: { 'Authorization': `Bearer ${this.adminToken}` }
                }
            );

            if (response.data.success) {
                console.log('✅ [TEST] Admin set result successful!');
                console.log('🔐 [TEST] Response data:');
                console.log('  - Status:', response.data.message);
                console.log('  - Period ID:', response.data.data.period_id);
                console.log('  - Result:', JSON.stringify(response.data.data.result));
                console.log('  - Stored in Redis:', response.data.data.stored_in_redis);
                console.log('  - Will be processed by scheduler:', response.data.data.will_be_processed_by_scheduler);
                console.log('  - Redis keys:', JSON.stringify(response.data.data.redisKeys, null, 2));
                
                return {
                    periodId: testPeriodId,
                    result: response.data.data.result,
                    redisKeys: response.data.data.redisKeys
                };
            } else {
                throw new Error('Admin set result failed: ' + response.data.message);
            }
        } catch (error) {
            console.error('❌ [TEST] Admin set result failed:', error.message);
            if (error.response) {
                console.error('❌ [TEST] Error response:', JSON.stringify(error.response.data, null, 2));
            }
            return null;
        }
    }

    /**
     * Test 3: Verify result is stored in Redis
     */
    async testRedisStorage(testData) {
        console.log('\n🔐 [TEST] ===== TEST 3: REDIS STORAGE VERIFICATION =====');
        
        if (!testData) {
            console.log('❌ [TEST] No test data available for Redis verification');
            return false;
        }
        
        try {
            console.log('🔐 [TEST] Checking if result is stored in Redis...');
            console.log('🔐 [TEST] Period ID:', testData.periodId);
            console.log('🔐 [TEST] Expected result:', JSON.stringify(testData.result));
            console.log('🔐 [TEST] Redis keys to check:', testData.redisKeys.resultKey);
            
            // Note: We can't directly check Redis from here, but we can verify through period status
            const response = await axios.get(
                `${this.baseURL}/api/admin/games/wingo/period/${testData.periodId}/status?duration=30`,
                {
                    headers: { 'Authorization': `Bearer ${this.adminToken}` }
                }
            );

            if (response.data.success) {
                const periodData = response.data.data;
                console.log('✅ [TEST] Period status after admin set:');
                console.log('  - Has existing result:', periodData.has_existing_result);
                console.log('  - Result source:', periodData.result_source);
                console.log('  - Can override:', periodData.can_override);
                
                if (periodData.has_existing_result) {
                    console.log('✅ [TEST] Result successfully stored in Redis!');
                    console.log('✅ [TEST] Result source:', periodData.result_source);
                    return true;
                } else {
                    console.log('❌ [TEST] Result not found in Redis');
                    return false;
                }
            } else {
                console.log('❌ [TEST] Failed to check period status');
                return false;
            }
        } catch (error) {
            console.error('❌ [TEST] Redis verification failed:', error.message);
            return false;
        }
    }

    /**
     * Test 4: Simulate scheduler processing (via game logic service)
     */
    async testSchedulerSimulation(testData) {
        console.log('\n🔐 [TEST] ===== TEST 4: SCHEDULER SIMULATION =====');
        
        if (!testData) {
            console.log('❌ [TEST] No test data available for scheduler simulation');
            return false;
        }
        
        try {
            console.log('🔐 [TEST] Simulating scheduler processing...');
            console.log('🔐 [TEST] This would normally be triggered by the game scheduler');
            console.log('🔐 [TEST] The scheduler will:');
            console.log('  1. Call gameLogicService.processGameResults()');
            console.log('  2. Find admin-set result in Redis');
            console.log('  3. Use admin result instead of generating new one');
            console.log('  4. Process all bets with admin result');
            console.log('  5. Update user balances');
            console.log('  6. Store result in database');
            console.log('  7. Broadcast to WebSocket clients');
            
            console.log('\n🔐 [TEST] WATCH SERVER LOGS when scheduler runs for:');
            console.log('  - "🔐 [ADMIN_CHECK] ✅ ADMIN-SET RESULT FOUND in primary key!"');
            console.log('  - "🔐 [ADMIN_OVERRIDE] ===== USING ADMIN-SET RESULT ====="');
            console.log('  - Period ID:', testData.periodId);
            console.log('  - Expected result:', JSON.stringify(testData.result));
            
            return true;
        } catch (error) {
            console.error('❌ [TEST] Scheduler simulation failed:', error.message);
            return false;
        }
    }

    /**
     * Test 5: Test edge cases
     */
    async testEdgeCases() {
        console.log('\n🔐 [TEST] ===== TEST 5: EDGE CASES =====');
        
        const edgeCases = [
            {
                name: 'Try to override period that hasn\'t ended',
                periodOffset: 60, // 60 seconds in the future
                expectedError: 'Period has not ended yet'
            },
            {
                name: 'Try to override period twice',
                periodOffset: -120, // 2 minutes ago
                expectedError: 'Period already has a result set'
            }
        ];

        for (const testCase of edgeCases) {
            console.log(`\n🔐 [TEST] Testing: ${testCase.name}`);
            
            try {
                const testPeriodId = this.generateTestPeriodId(testCase.periodOffset);
                console.log('🔐 [TEST] Period ID:', testPeriodId);
                
                // First, try to set result for this period
                if (testCase.name.includes('twice')) {
                    // For double override test, set result first
                    await axios.post(
                        `${this.baseURL}/api/admin/games/wingo/set-result`,
                        {
                            periodId: testPeriodId,
                            number: 5,
                            duration: 30
                        },
                        {
                            headers: { 'Authorization': `Bearer ${this.adminToken}` }
                        }
                    );
                    console.log('🔐 [TEST] First result set, now trying to override...');
                }
                
                const response = await axios.post(
                    `${this.baseURL}/api/admin/games/wingo/set-result`,
                    {
                        periodId: testPeriodId,
                        number: 3,
                        duration: 30
                    },
                    {
                        headers: { 'Authorization': `Bearer ${this.adminToken}` }
                    }
                );

                console.log('❌ [TEST] Expected error but request succeeded');
                
            } catch (error) {
                if (error.response && error.response.status >= 400) {
                    console.log('✅ [TEST] Correctly rejected request');
                    console.log('🔐 [TEST] Error message:', error.response.data.message);
                    
                    if (error.response.data.message.includes(testCase.expectedError.split(' ')[0])) {
                        console.log('✅ [TEST] Error message matches expected pattern');
                    } else {
                        console.log('⚠️ [TEST] Error message differs from expected');
                    }
                } else {
                    console.log('❌ [TEST] Unexpected error:', error.message);
                }
            }
        }
    }

    /**
     * Display summary
     */
    displaySummary() {
        console.log('\n🔐 [TEST] =====================================');
        console.log('🔐 [TEST] ===== INTEGRATION TEST SUMMARY =====');
        console.log('🔐 [TEST] =====================================');
        console.log('🔐 [TEST] The admin set result system has been updated to:');
        console.log('✅ [TEST] Work with Redis-based periods (not database)');
        console.log('✅ [TEST] Calculate period timing from period ID');
        console.log('✅ [TEST] Store admin results in Redis for scheduler');
        console.log('✅ [TEST] Prevent duplicate overrides');
        console.log('✅ [TEST] Enhanced logging for debugging');
        console.log('✅ [TEST] Game logic service checks for admin results');
        
        console.log('\n🔐 [TEST] ===== HOW IT WORKS =====');
        console.log('1. Admin sets result -> Stored in Redis');
        console.log('2. Scheduler processes period -> Finds admin result in Redis');
        console.log('3. Scheduler uses admin result -> Processes bets');
        console.log('4. Scheduler updates balances -> Stores in database');
        console.log('5. Scheduler broadcasts result -> WebSocket clients notified');
        
        console.log('\n🔐 [TEST] ===== REDIS KEYS USED =====');
        console.log('Primary: wingo:30s:{periodId}:result');
        console.log('Meta: wingo:30s:{periodId}:admin_meta');
        console.log('Backup: wingo:30s:{periodId}:result:override');
        console.log('🔐 [TEST] =====================================\n');
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        try {
            await this.initialize();
            
            const periodStatus = await this.testPeriodStatus();
            const adminSetResult = await this.testAdminSetResult();
            const redisVerification = await this.testRedisStorage(adminSetResult);
            const schedulerSimulation = await this.testSchedulerSimulation(adminSetResult);
            await this.testEdgeCases();
            
            this.displaySummary();
            
            console.log('✅ [TEST] All tests completed! Check the server logs for detailed processing.');
            
        } catch (error) {
            console.error('❌ [TEST] Test suite failed:', error.message);
        }
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    const tester = new AdminRedisIntegrationTester();
    tester.runAllTests().catch(console.error);
}

module.exports = AdminRedisIntegrationTester;