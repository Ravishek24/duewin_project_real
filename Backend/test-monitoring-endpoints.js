#!/usr/bin/env node

/**
 * Quick test script for the new monitoring endpoints
 * Run with: node test-monitoring-endpoints.js
 */

const axios = require('axios');

// Configuration - Update with your actual backend URL
const BASE_URL = 'https://api.strikecolor1.com'; // Update with your actual backend URL

async function testMonitoringEndpoints() {
    console.log('🧪 Testing New Monitoring Endpoints...\n');

    const endpoints = [
        '/monitoring/database-locks',
        '/monitoring/credit-service-status', 
        '/monitoring/health',
        '/monitoring/database-pool'
    ];

    for (const endpoint of endpoints) {
        console.log(`🔍 Testing ${endpoint}...`);
        try {
            const response = await axios.get(`${BASE_URL}${endpoint}`);
            console.log(`✅ ${endpoint} - Status: ${response.status}`);
            console.log(`   Success: ${response.data.success}`);
            if (response.data.note) {
                console.log(`   Note: ${response.data.note}`);
            }
        } catch (error) {
            console.log(`❌ ${endpoint} - Failed: ${error.response?.status || error.message}`);
            if (error.response?.data?.error) {
                console.log(`   Error: ${error.response.data.error}`);
            }
        }
        console.log('');
    }

    console.log('🎉 Monitoring endpoints test completed!');
}

// Check if axios is available
try {
    require.resolve('axios');
    testMonitoringEndpoints();
} catch (error) {
    console.log('❌ Axios not found. Install it with: npm install axios');
    console.log('\n   Or use curl to test manually:');
    console.log('   curl https://api.strikecolor1.com/monitoring/database-locks');
    console.log('   curl https://api.strikecolor1.com/monitoring/credit-service-status');
    console.log('   curl https://api.strikecolor1.com/monitoring/health');
    console.log('   curl https://api.strikecolor1.com/monitoring/database-pool');
}
