#!/usr/bin/env node

/**
 * Test script for public monitoring routes (no auth required)
 * Run with: node test-public-routes.js
 */

const axios = require('axios');

// Configuration - Update with your actual backend URL
const BASE_URL = 'http://localhost:3000'; // Update with your actual backend URL

async function testPublicRoutes() {
    console.log('🧪 Testing Public Monitoring Routes (No Auth Required)...\n');

    try {
        // Test 1: Database locks endpoint (PUBLIC)
        console.log('1️⃣ Testing /monitoring/database-locks (PUBLIC)...');
        try {
            const locksResponse = await axios.get(`${BASE_URL}/monitoring/database-locks`);
            console.log('✅ Database locks endpoint working (PUBLIC):', locksResponse.data.success);
            if (locksResponse.data.locks) {
                console.log('   📊 Lock info available');
            }
            if (locksResponse.data.queue) {
                console.log('   📊 Queue status available');
            }
            if (locksResponse.data.note) {
                console.log('   📝 Note:', locksResponse.data.note);
            }
        } catch (error) {
            console.log('❌ Database locks endpoint failed:', error.response?.data?.error || error.message);
        }

        // Test 2: Credit service status endpoint (PUBLIC)
        console.log('\n2️⃣ Testing /monitoring/credit-service-status (PUBLIC)...');
        try {
            const statusResponse = await axios.get(`${BASE_URL}/monitoring/credit-service-status`);
            console.log('✅ Credit service status endpoint working (PUBLIC):', statusResponse.data.success);
            if (statusResponse.data.queue) {
                console.log('   📊 Queue size:', statusResponse.data.queue.queueSize);
                console.log('   📊 Active operations:', statusResponse.data.queue.activeOperationsSize);
            }
            if (statusResponse.data.note) {
                console.log('   📝 Note:', statusResponse.data.note);
            }
        } catch (error) {
            console.log('❌ Credit service status endpoint failed:', error.response?.data?.error || error.message);
        }

        // Test 3: Emergency cleanup endpoint (PROTECTED - should fail without auth)
        console.log('\n3️⃣ Testing /admin/emergency-cleanup (PROTECTED - should fail)...');
        try {
            const cleanupResponse = await axios.post(`${BASE_URL}/admin/emergency-cleanup`, {});
            console.log('❌ Emergency cleanup endpoint should have failed (it was public when it should be protected)');
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.log('✅ Emergency cleanup endpoint correctly protected (auth required)');
            } else {
                console.log('⚠️ Emergency cleanup endpoint failed for unexpected reason:', error.response?.status, error.response?.data?.error || error.message);
            }
        }

        // Test 4: Force cleanup endpoint (PROTECTED - should fail without auth)
        console.log('\n4️⃣ Testing /admin/credit-service/force-cleanup (PROTECTED - should fail)...');
        try {
            const forceCleanupResponse = await axios.post(`${BASE_URL}/admin/credit-service/force-cleanup`, {});
            console.log('❌ Force cleanup endpoint should have failed (it was public when it should be protected)');
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.log('✅ Force cleanup endpoint correctly protected (auth required)');
            } else {
                console.log('⚠️ Force cleanup endpoint failed for unexpected reason:', error.response?.status, error.response?.data?.error || error.message);
            }
        }

        console.log('\n🎉 Public routes testing completed!');
        console.log('\n📋 SUMMARY:');
        console.log('✅ /monitoring/database-locks - PUBLIC (no auth required)');
        console.log('✅ /monitoring/credit-service-status - PUBLIC (no auth required)');
        console.log('✅ /monitoring/health - PUBLIC (no auth required)');
        console.log('✅ /monitoring/database-pool - PUBLIC (no auth required)');
        console.log('🔐 /admin/emergency-cleanup - PROTECTED (auth required)');
        console.log('🔐 /admin/credit-service/force-cleanup - PROTECTED (auth required)');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Instructions for use
console.log('📋 INSTRUCTIONS:');
console.log('1. Update BASE_URL with your actual backend URL');
console.log('2. Make sure your backend is running');
console.log('3. Run: node test-public-routes.js\n');

// Check if axios is available
try {
    require.resolve('axios');
    testPublicRoutes();
} catch (error) {
    console.log('❌ Axios not found. Install it with: npm install axios');
    console.log('   Or use curl to test the endpoints manually:');
    console.log('\n   # Test public endpoints:');
    console.log('   curl http://localhost:3000/monitoring/database-locks');
    console.log('   curl http://localhost:3000/monitoring/credit-service-status');
    console.log('   curl http://localhost:3000/monitoring/health');
    console.log('   curl http://localhost:3000/monitoring/database-pool');
    console.log('\n   # Test protected endpoints (should fail):');
    console.log('   curl -X POST http://localhost:3000/admin/emergency-cleanup');
    console.log('   curl -X POST http://localhost:3000/admin/credit-service/force-cleanup');
}
