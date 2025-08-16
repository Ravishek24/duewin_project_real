#!/usr/bin/env node
/**
 * Test script for Admin Set Result with Enhanced Logging
 * This script tests the admin set result functionality and demonstrates the comprehensive logging
 */

const axios = require('axios');
const moment = require('moment-timezone');

class AdminSetResultTester {
    constructor() {
        this.baseURL = process.env.API_BASE_URL || 'http://localhost:3001';
        this.adminToken = null;
        this.testResults = [];
    }

    /**
     * Initialize the test by getting admin token
     */
    async initialize() {
        console.log('🔐 [TEST] ===== ADMIN SET RESULT TESTING WITH ENHANCED LOGS =====');
        console.log('🔐 [TEST] Base URL:', this.baseURL);
        console.log('🔐 [TEST] Timestamp:', new Date().toISOString());
        
        try {
            // Get admin token using direct login
            console.log('\n🔐 [TEST] Step 1: Getting admin authentication...');
            const adminLoginResponse = await axios.post(`${this.baseURL}/api/admin/direct-login`, {
                email: 'admin@diuwin.com' // Adjust this email as needed
            });

            if (adminLoginResponse.data.success) {
                this.adminToken = adminLoginResponse.data.data.token;
                console.log('✅ [TEST] Admin token obtained successfully');
                console.log('🔐 [TEST] Admin user:', adminLoginResponse.data.data.user.user_id);
            } else {
                throw new Error('Failed to get admin token: ' + adminLoginResponse.data.message);
            }
        } catch (error) {
            console.error('❌ [TEST] Failed to initialize admin token:', error.message);
            throw error;
        }
    }

    /**
     * Get current period for testing
     */
    getCurrentPeriod(duration = 30) {
        const now = moment().tz('Asia/Kolkata');
        const periodNumber = Math.floor(now.valueOf() / (duration * 1000));
        return `${now.format('YYYYMMDD')}${String(periodNumber).padStart(6, '0')}`;
    }

    /**
     * Test 1: Check period status
     */
    async testPeriodStatus() {
        console.log('\n🔐 [TEST] ===== TEST 1: PERIOD STATUS CHECK =====');
        
        try {
            const currentPeriod = this.getCurrentPeriod(30);
            console.log('🔐 [TEST] Current period ID:', currentPeriod);
            
            const response = await axios.get(
                `${this.baseURL}/api/admin/games/wingo/period/${currentPeriod}/status`,
                {
                    headers: { 'Authorization': `Bearer ${this.adminToken}` }
                }
            );

            if (response.data.success) {
                console.log('✅ [TEST] Period status check successful');
                console.log('🔐 [TEST] Period data:', JSON.stringify(response.data.data, null, 2));
                
                this.testResults.push({
                    test: 'Period Status Check',
                    status: 'PASS',
                    data: response.data.data
                });
                
                return response.data.data;
            } else {
                throw new Error('Period status check failed: ' + response.data.message);
            }
        } catch (error) {
            console.error('❌ [TEST] Period status check failed:', error.message);
            this.testResults.push({
                test: 'Period Status Check',
                status: 'FAIL',
                error: error.message
            });
            return null;
        }
    }

    /**
     * Test 2: Set admin result with comprehensive logging observation
     */
    async testAdminSetResult() {
        console.log('\n🔐 [TEST] ===== TEST 2: ADMIN SET RESULT =====');
        
        try {
            const currentPeriod = this.getCurrentPeriod(30);
            const testNumber = Math.floor(Math.random() * 10); // Random number 0-9
            
            console.log('🔐 [TEST] Test parameters:');
            console.log('🔐 [TEST] - Period ID:', currentPeriod);
            console.log('🔐 [TEST] - Number:', testNumber);
            console.log('🔐 [TEST] - Duration: 30');
            console.log('🔐 [TEST] - Timeline: default');
            
            console.log('\n🔐 [TEST] WATCH THE SERVER LOGS FOR DETAILED ADMIN OVERRIDE PROCESSING...');
            console.log('🔐 [TEST] Look for logs starting with: 🔐 [ADMIN_OVERRIDE]');
            
            const startTime = Date.now();
            
            const response = await axios.post(
                `${this.baseURL}/api/admin/games/wingo/set-result`,
                {
                    periodId: currentPeriod,
                    number: testNumber,
                    duration: 30,
                    timeline: 'default'
                },
                {
                    headers: { 'Authorization': `Bearer ${this.adminToken}` }
                }
            );

            const endTime = Date.now();
            const duration = endTime - startTime;

            if (response.data.success) {
                console.log('✅ [TEST] Admin set result successful!');
                console.log('🔐 [TEST] Response time:', duration, 'ms');
                console.log('🔐 [TEST] Response data:', JSON.stringify(response.data, null, 2));
                
                this.testResults.push({
                    test: 'Admin Set Result',
                    status: 'PASS',
                    duration: duration,
                    data: response.data
                });
                
                return response.data;
            } else {
                throw new Error('Admin set result failed: ' + response.data.message);
            }
        } catch (error) {
            console.error('❌ [TEST] Admin set result failed:', error.message);
            if (error.response) {
                console.error('❌ [TEST] Error response:', JSON.stringify(error.response.data, null, 2));
            }
            
            this.testResults.push({
                test: 'Admin Set Result',
                status: 'FAIL',
                error: error.message,
                errorResponse: error.response?.data
            });
            
            return null;
        }
    }

    /**
     * Test 3: Verify the result was processed correctly
     */
    async testResultVerification() {
        console.log('\n🔐 [TEST] ===== TEST 3: RESULT VERIFICATION =====');
        
        try {
            // Wait a moment for processing to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const currentPeriod = this.getCurrentPeriod(30);
            
            const response = await axios.get(
                `${this.baseURL}/api/admin/games/wingo/period/${currentPeriod}/status`,
                {
                    headers: { 'Authorization': `Bearer ${this.adminToken}` }
                }
            );

            if (response.data.success) {
                const periodData = response.data.data;
                console.log('✅ [TEST] Result verification successful');
                console.log('🔐 [TEST] Period completion status:', periodData.is_completed);
                console.log('🔐 [TEST] Can override now:', periodData.can_override);
                
                this.testResults.push({
                    test: 'Result Verification',
                    status: 'PASS',
                    data: periodData
                });
                
                return periodData;
            } else {
                throw new Error('Result verification failed: ' + response.data.message);
            }
        } catch (error) {
            console.error('❌ [TEST] Result verification failed:', error.message);
            this.testResults.push({
                test: 'Result Verification',
                status: 'FAIL',
                error: error.message
            });
            return null;
        }
    }

    /**
     * Test invalid scenarios to verify validation and logging
     */
    async testValidationScenarios() {
        console.log('\n🔐 [TEST] ===== TEST 4: VALIDATION SCENARIOS =====');
        
        const scenarios = [
            {
                name: 'Missing Period ID',
                data: { number: 5 },
                expectedError: 'Period ID and number are required'
            },
            {
                name: 'Missing Number',
                data: { periodId: '20250106000001001' },
                expectedError: 'Period ID and number are required'
            },
            {
                name: 'Invalid Number (too high)',
                data: { periodId: '20250106000001001', number: 15 },
                expectedError: 'Number must be between 0 and 9'
            },
            {
                name: 'Invalid Number (negative)',
                data: { periodId: '20250106000001001', number: -1 },
                expectedError: 'Number must be between 0 and 9'
            },
            {
                name: 'Non-existent Period',
                data: { periodId: '19900101000000001', number: 5 },
                expectedError: 'Period not found'
            }
        ];

        for (const scenario of scenarios) {
            console.log(`\n🔐 [TEST] Testing: ${scenario.name}`);
            console.log('🔐 [TEST] Request data:', JSON.stringify(scenario.data, null, 2));
            
            try {
                const response = await axios.post(
                    `${this.baseURL}/api/admin/games/wingo/set-result`,
                    scenario.data,
                    {
                        headers: { 'Authorization': `Bearer ${this.adminToken}` }
                    }
                );

                // If we get here, the request succeeded when it should have failed
                console.log('❌ [TEST] Expected validation to fail, but it succeeded');
                this.testResults.push({
                    test: `Validation: ${scenario.name}`,
                    status: 'FAIL',
                    error: 'Expected validation error but request succeeded'
                });
                
            } catch (error) {
                if (error.response && error.response.status >= 400 && error.response.status < 500) {
                    console.log('✅ [TEST] Validation correctly rejected the request');
                    console.log('🔐 [TEST] Error message:', error.response.data.message);
                    console.log('🔐 [TEST] Request ID:', error.response.data.requestId);
                    
                    this.testResults.push({
                        test: `Validation: ${scenario.name}`,
                        status: 'PASS',
                        errorMessage: error.response.data.message
                    });
                } else {
                    console.log('❌ [TEST] Unexpected error occurred');
                    this.testResults.push({
                        test: `Validation: ${scenario.name}`,
                        status: 'FAIL',
                        error: error.message
                    });
                }
            }
        }
    }

    /**
     * Display comprehensive test results
     */
    displayResults() {
        console.log('\n🔐 [TEST] =====================================');
        console.log('🔐 [TEST] ===== TEST RESULTS SUMMARY =====');
        console.log('🔐 [TEST] =====================================');
        
        let passed = 0;
        let failed = 0;
        
        this.testResults.forEach((result, index) => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${status} [TEST] ${index + 1}. ${result.test}: ${result.status}`);
            
            if (result.status === 'PASS') {
                passed++;
            } else {
                failed++;
                if (result.error) {
                    console.log(`    Error: ${result.error}`);
                }
            }
            
            if (result.duration) {
                console.log(`    Duration: ${result.duration}ms`);
            }
        });
        
        console.log('\n🔐 [TEST] ===== FINAL SUMMARY =====');
        console.log(`🔐 [TEST] Total tests: ${this.testResults.length}`);
        console.log(`✅ [TEST] Passed: ${passed}`);
        console.log(`❌ [TEST] Failed: ${failed}`);
        console.log(`🔐 [TEST] Success rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
        
        console.log('\n🔐 [TEST] ===== LOGGING INFORMATION =====');
        console.log('🔐 [TEST] Enhanced logging has been added to the admin set result function');
        console.log('🔐 [TEST] Look for these log patterns in your server console:');
        console.log('🔐 [TEST] - 🔐 [ADMIN_OVERRIDE] for all admin override operations');
        console.log('🔐 [TEST] - ✅ [ADMIN_OVERRIDE] for successful operations');
        console.log('🔐 [TEST] - ❌ [ADMIN_OVERRIDE] for errors and failures');
        console.log('🔐 [TEST] - 🔐 [ADMIN_CHECK] for override checking in game logic service');
        console.log('🔐 [TEST] =====================================\n');
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        try {
            await this.initialize();
            await this.testPeriodStatus();
            await this.testAdminSetResult();
            await this.testResultVerification();
            await this.testValidationScenarios();
            this.displayResults();
        } catch (error) {
            console.error('❌ [TEST] Test suite failed:', error.message);
        }
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    const tester = new AdminSetResultTester();
    tester.runAllTests().catch(console.error);
}

module.exports = AdminSetResultTester;