// signature-debug.js - Debug the exact signature issue
const crypto = require('crypto');

const SALT_KEY = 'zPNWR8Y91Y';
const RECEIVED_KEY = '4bac38b952e06030d3d01b1b02e2e23588b98567';

const params = {
  callerId: 'flywin_mc_s',
  callerPassword: '2c90816c9475027980a84afd2ba3a7c03817011e',
  callerPrefix: '8fa8',
  action: 'balance',
  remote_id: '1992440',
  username: 'player13',
  session_id: '68366c46e4915',
  currency: 'EUR',
  provider: 'sr',
  gamesession_id: 'sr_149677-1703685-08b57c412ffa27c7f8d0c4b5db5b586c',
  original_session_id: '68366c46e4915'
};

console.log('🔍 Testing different parameter orders to find the correct one...\n');

// Test 1: Your current sorted order
console.log('Test 1: Alphabetically sorted order');
const sortedKeys = Object.keys(params).sort();
const sortedQueryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
const sortedSignature = crypto.createHash('sha1').update(SALT_KEY + sortedQueryString).digest('hex');
console.log('Query string:', sortedQueryString);
console.log('Generated signature:', sortedSignature);
console.log('Matches received?', sortedSignature === RECEIVED_KEY);
console.log('');

// Test 2: URL parameter order (most likely correct)
console.log('Test 2: Likely URL parameter order');
const urlOrder = [
  'callerId', 'callerPassword', 'callerPrefix', 'action', 'remote_id', 
  'username', 'session_id', 'currency', 'provider', 'gamesession_id', 'original_session_id'
];
const urlQueryString = urlOrder.map(key => `${key}=${params[key]}`).join('&');
const urlSignature = crypto.createHash('sha1').update(SALT_KEY + urlQueryString).digest('hex');
console.log('Query string:', urlQueryString);
console.log('Generated signature:', urlSignature);
console.log('Matches received?', urlSignature === RECEIVED_KEY);
console.log('');

// Test 3: Alternative order based on common patterns
console.log('Test 3: Alternative common order');
const altOrder = [
  'action', 'callerId', 'callerPassword', 'callerPrefix', 'remote_id',
  'username', 'session_id', 'currency', 'provider', 'gamesession_id', 'original_session_id'
];
const altQueryString = altOrder.map(key => `${key}=${params[key]}`).join('&');
const altSignature = crypto.createHash('sha1').update(SALT_KEY + altQueryString).digest('hex');
console.log('Query string:', altQueryString);
console.log('Generated signature:', altSignature);
console.log('Matches received?', altSignature === RECEIVED_KEY);
console.log('');

// Test 4: Try all possible permutations (brute force for small sets)
console.log('Test 4: Trying different logical orders...');

const testOrders = [
  // Provider-first order
  ['provider', 'callerId', 'callerPassword', 'callerPrefix', 'action', 'remote_id', 'username', 'session_id', 'currency', 'gamesession_id', 'original_session_id'],
  
  // Session-first order
  ['session_id', 'gamesession_id', 'original_session_id', 'callerId', 'callerPassword', 'callerPrefix', 'action', 'remote_id', 'username', 'currency', 'provider'],
  
  // Remote-first order
  ['remote_id', 'username', 'session_id', 'callerId', 'callerPassword', 'callerPrefix', 'action', 'currency', 'provider', 'gamesession_id', 'original_session_id'],
  
  // Auth-first order
  ['callerId', 'callerPassword', 'callerPrefix', 'remote_id', 'username', 'session_id', 'action', 'currency', 'provider', 'gamesession_id', 'original_session_id']
];

testOrders.forEach((order, index) => {
  const testQueryString = order.map(key => `${key}=${params[key]}`).join('&');
  const testSignature = crypto.createHash('sha1').update(SALT_KEY + testQueryString).digest('hex');
  console.log(`Order ${index + 1}:`, testSignature === RECEIVED_KEY ? '✅ MATCH!' : '❌ No match');
  if (testSignature === RECEIVED_KEY) {
    console.log('  Winning query string:', testQueryString);
    console.log('  Winning order:', order);
  }
});

console.log('\n🔍 Received signature:', RECEIVED_KEY);
console.log('🔍 Salt key:', SALT_KEY);

// Test 5: Maybe the provider is URL-encoding some values?
console.log('\nTest 5: Checking for URL encoding differences...');
const urlEncodedQueryString = sortedKeys.map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
const urlEncodedSignature = crypto.createHash('sha1').update(SALT_KEY + urlEncodedQueryString).digest('hex');
console.log('URL encoded signature:', urlEncodedSignature);
console.log('Matches received?', urlEncodedSignature === RECEIVED_KEY);

// Test 6: What if there are additional hidden parameters?
console.log('\nTest 6: Checking if we might be missing parameters...');
console.log('All parameters we received:', Object.keys(params));
console.log('This test assumes we have all parameters.');

console.log('\n🎯 Recommendation:');
console.log('If none of these match, the provider might be using a different salt key,');
console.log('or there might be additional parameters we\'re not seeing in the logs.');
console.log('Consider temporarily setting BYPASS_SIGNATURE_VALIDATION=true to debug the callback functionality.');