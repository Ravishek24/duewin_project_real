const crypto = require('crypto');

// SPRIBE configuration
const clientId = 'strike';
const clientSecret = '4zN47mqNcLqKo6XvHetOVVPEByX52ILQ';
const path = '/api/spribe/callback';
const timestamp = Math.floor(Date.now() / 1000);
const body = {
  action: 'auth',
  user_token: '5a98ef8fec316fd67affb3d662992f9fff1dfabfbdcade0833513561231db92c',
  session_token: 'test_session_token',
  platform: 'desktop',
  currency: 'USD'
};

// Create signature
const hmac = crypto.createHmac('sha256', clientSecret);
hmac.update(timestamp.toString());
hmac.update(path);
hmac.update(JSON.stringify(body));
const signature = hmac.digest('hex');

// Generate curl command
console.log('\nTest SPRIBE callback with valid signature:');
console.log(`curl -v -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-Spribe-Client-ID: ${clientId}" \\
  -H "X-Spribe-Client-TS: ${timestamp}" \\
  -H "X-Spribe-Client-Signature: ${signature}" \\
  -d '${JSON.stringify(body)}' \\
  https://strike.atsproduct.in/api/spribe/callback\n`);

// Log details for debugging
console.log('Signature details:');
console.log({
  clientId,
  timestamp,
  path,
  body,
  signature
}); 