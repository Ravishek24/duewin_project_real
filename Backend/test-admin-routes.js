#!/usr/bin/env node

/**
 * Test script for new admin routes
 * Run with: node test-admin-routes.js
 */

const axios = require('axios');

// Configuration - Update these values
const BASE_URL = 'http://localhost:3000'; // Update with your actual backend URL
const ADMIN_TOKEN = 'your_admin_jwt_token_here'; // You'll need to get this from admin login

async function testAdminRoutes() {
    console.log('🧪 Testing New Admin Routes...\n');

    const headers = {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
    };

    try {
        // Test 1: Database locks endpoint
        console.log('1️⃣ Testing /admin/database-locks...');
        try {
            const locksResponse = await axios.get(`${BASE_URL}/admin/database-locks`, { headers });
            console.log('✅ Database locks endpoint working:', locksResponse.data.success);
            if (locksResponse.data.locks) {
                console.log('   📊 Lock info available');
            }
            if (locksResponse.data.queue) {
                console.log('   📊 Queue status available');
            }
        } catch (error) {
            console.log('❌ Database locks endpoint failed:', error.response?.data?.error || error.message);
        }

        // Test 2: Credit service status endpoint
        console.log('\n2️⃣ Testing /admin/credit-service-status...');
        try {
            const statusResponse = await axios.get(`${BASE_URL}/admin/credit-service-status`, { headers });
            console.log('✅ Credit service status endpoint working:', statusResponse.data.success);
            if (statusResponse.data.queue) {
                console.log('   📊 Queue size:', statusResponse.data.queue.queueSize);
                console.log('   📊 Active operations:', statusResponse.data.queue.activeOperationsSize);
            }
        } catch (error) {
            console.log('❌ Credit service status endpoint failed:', error.response?.data?.error || error.message);
        }

        // Test 3: Emergency cleanup endpoint
        console.log('\n3️⃣ Testing /admin/emergency-cleanup...');
        try {
            const cleanupResponse = await axios.post(`${BASE_URL}/admin/emergency-cleanup`, {}, { headers });
            console.log('✅ Emergency cleanup endpoint working:', cleanupResponse.data.success);
            if (cleanupResponse.data.result) {
                console.log('   🧹 Cleanup completed');
            }
        } catch (error) {
            console.log('❌ Emergency cleanup endpoint failed:', error.response?.data?.error || error.message);
        }

        // Test 4: Force cleanup endpoint
        console.log('\n4️⃣ Testing /admin/credit-service/force-cleanup...');
        try {
            const forceCleanupResponse = await axios.post(`${BASE_URL}/admin/credit-service/force-cleanup`, {}, { headers });
            console.log('✅ Force cleanup endpoint working:', forceCleanupResponse.data.success);
            if (forceCleanupResponse.data.cleanedOperations !== undefined) {
                console.log('   🧹 Cleaned operations:', forceCleanupResponse.data.cleanedOperations);
            }
        } catch (error) {
            console.log('❌ Force cleanup endpoint failed:', error.response?.data?.error || error.message);
        }

        console.log('\n🎉 Admin routes testing completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Instructions for use
console.log('📋 INSTRUCTIONS:');
console.log('1. Update BASE_URL with your actual backend URL');
console.log('2. Get an admin JWT token by logging in to your admin panel');
console.log('3. Update ADMIN_TOKEN with the actual token');
console.log('4. Run: node test-admin-routes.js\n');

// Check if axios is available
try {
    require.resolve('axios');
    testAdminRoutes();
} catch (error) {
    console.log('❌ Axios not found. Install it with: npm install axios');
    console.log('   Or use curl/Postman to test the endpoints manually.');
}
