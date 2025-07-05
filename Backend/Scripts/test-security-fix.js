#!/usr/bin/env node

/**
 * Test Security Fix
 * Verifies that the attack protection middleware works without errors
 */

const { attackProtection } = require('../middleware/attackProtection');

// Mock request object
const mockReq = {
    path: '/test',
    method: 'GET',
    body: {},
    query: {},
    headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    connection: {
        remoteAddress: '127.0.0.1'
    }
};

// Mock response object
const mockRes = {
    status: (code) => ({
        json: (data) => {
            console.log(`Response: ${code}`, data);
            return mockRes;
        }
    })
};

// Mock next function
const mockNext = () => {
    console.log('✅ Middleware passed to next()');
};

console.log('🧪 Testing Attack Protection Middleware...');

// Test 1: Normal request
console.log('\n📋 Test 1: Normal request');
attackProtection(mockReq, mockRes, mockNext);

// Test 2: Request with undefined path
console.log('\n📋 Test 2: Request with undefined path');
const mockReq2 = { ...mockReq, path: undefined };
attackProtection(mockReq2, mockRes, mockNext);

// Test 3: Request with suspicious path
console.log('\n📋 Test 3: Request with suspicious path');
const mockReq3 = { ...mockReq, path: '/.git/config' };
attackProtection(mockReq3, mockRes, mockNext);

// Test 4: Request with undefined body
console.log('\n📋 Test 4: Request with undefined body');
const mockReq4 = { ...mockReq, body: undefined };
attackProtection(mockReq4, mockRes, mockNext);

// Test 5: Request with undefined query
console.log('\n📋 Test 5: Request with undefined query');
const mockReq5 = { ...mockReq, query: undefined };
attackProtection(mockReq5, mockRes, mockNext);

console.log('\n✅ Security middleware test completed!');
console.log('If you see no errors above, the fix is working correctly.'); 