const axios = require('axios');

/**
 * Test script to verify security headers are properly applied
 */
async function testSecurityHeaders() {
    const baseURL = process.env.TEST_URL || 'http://localhost:8000';
    
    console.log('🔒 Testing Security Headers...');
    console.log(`Target URL: ${baseURL}`);
    console.log('=' .repeat(50));

    try {
        // Test basic endpoint
        const response = await axios.get(`${baseURL}/health`, {
            timeout: 5000,
            validateStatus: () => true // Don't throw on non-2xx status
        });

        console.log(`✅ Response Status: ${response.status}`);
        console.log('\n📋 Security Headers Check:');
        console.log('=' .repeat(50));

        // Required security headers
        const requiredHeaders = {
            'Content-Security-Policy': 'Content Security Policy',
            'X-Frame-Options': 'X-Frame-Options',
            'X-Content-Type-Options': 'X-Content-Type-Options',
            'Referrer-Policy': 'Referrer Policy',
            'Permissions-Policy': 'Permissions Policy'
        };

        // Additional security headers
        const additionalHeaders = {
            'X-XSS-Protection': 'X-XSS-Protection',
            'Strict-Transport-Security': 'HSTS',
            'X-Permitted-Cross-Domain-Policies': 'X-Permitted-Cross-Domain-Policies',
            'Cross-Origin-Opener-Policy': 'Cross-Origin-Opener-Policy',
            'Cross-Origin-Embedder-Policy': 'Cross-Origin-Embedder-Policy'
        };

        let allHeadersPresent = true;
        let missingHeaders = [];

        // Check required headers
        console.log('\n🔍 Required Headers:');
        for (const [header, description] of Object.entries(requiredHeaders)) {
            const value = response.headers[header.toLowerCase()];
            if (value) {
                console.log(`✅ ${description}: ${value}`);
            } else {
                console.log(`❌ ${description}: MISSING`);
                allHeadersPresent = false;
                missingHeaders.push(header);
            }
        }

        // Check additional headers
        console.log('\n🔍 Additional Security Headers:');
        for (const [header, description] of Object.entries(additionalHeaders)) {
            const value = response.headers[header.toLowerCase()];
            if (value) {
                console.log(`✅ ${description}: ${value}`);
            } else {
                console.log(`⚠️  ${description}: Not present (optional)`);
            }
        }

        // Check for X-Powered-By (should be removed)
        console.log('\n🔍 Server Information:');
        const poweredBy = response.headers['x-powered-by'];
        if (poweredBy) {
            console.log(`❌ X-Powered-By: ${poweredBy} (should be removed)`);
        } else {
            console.log(`✅ X-Powered-By: Removed (good)`);
        }

        // Summary
        console.log('\n' + '=' .repeat(50));
        console.log('📊 SECURITY HEADERS SUMMARY:');
        console.log('=' .repeat(50));
        
        if (allHeadersPresent) {
            console.log('🎉 ALL REQUIRED SECURITY HEADERS ARE PRESENT!');
            console.log('✅ Your backend is properly secured');
        } else {
            console.log('⚠️  SOME REQUIRED HEADERS ARE MISSING:');
            missingHeaders.forEach(header => {
                console.log(`   - ${header}`);
            });
            console.log('\n🔧 Please check your security middleware configuration');
        }

        // Security recommendations
        console.log('\n💡 SECURITY RECOMMENDATIONS:');
        console.log('1. Ensure HTTPS is enabled in production');
        console.log('2. Regularly update dependencies');
        console.log('3. Monitor security logs');
        console.log('4. Consider implementing rate limiting');
        console.log('5. Use environment variables for sensitive data');

    } catch (error) {
        console.error('❌ Error testing security headers:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure your server is running on the specified port');
        }
    }
}

// Run the test
if (require.main === module) {
    testSecurityHeaders();
}

module.exports = { testSecurityHeaders }; 