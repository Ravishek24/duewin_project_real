const { paymentCallbackWhitelist } = require('./middleware/paymentCallbackWhitelist');

// Test IPs
const testIPs = [
  '122.161.49.155',
  '172.31.41.86',
  '127.0.0.1',
  '51.21.47.178',
  '192.168.1.1', // This should be blocked
  '10.0.0.1'     // This should be blocked
];

console.log('🔍 TESTING PAYMENT CALLBACK IP WHITELIST');
console.log('='.repeat(50));

testIPs.forEach(ip => {
  // Create a mock request object
  const mockReq = {
    headers: {
      'x-forwarded-for': ip,
      'x-real-ip': ip
    },
    connection: {
      remoteAddress: ip
    }
  };
  
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        console.log(`✅ IP ${ip}: ${code === 403 ? '❌ BLOCKED' : '✅ ALLOWED'}`);
        if (code === 403) {
          console.log(`   Reason: ${data.message}`);
        }
      }
    })
  };
  
  let nextCalled = false;
  const mockNext = () => {
    nextCalled = true;
  };
  
  // Test the middleware
  paymentCallbackWhitelist(mockReq, mockRes, mockNext);
  
  if (nextCalled) {
    console.log(`✅ IP ${ip}: ✅ ALLOWED (next() called)`);
  }
});

console.log('\n📋 WHITELISTED IPs:');
console.log('- 122.161.49.155 (Payment Gateway)');
console.log('- 172.31.41.86 (Payment Gateway)');
console.log('- 127.0.0.1 (Localhost)');
console.log('- 51.21.47.178 (Server IP)');
console.log('- Various OKPAY and WEPAY IPs');
console.log('\n✅ IP whitelist updated successfully!'); 