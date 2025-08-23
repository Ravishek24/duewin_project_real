const axios = require('axios');

/**
 * Test Auto-Transfer System for Casino Game Launch
 */
async function testAutoTransfer() {
  try {
    console.log('🎰 === TESTING AUTO-TRANSFER SYSTEM ===\n');
    
    // Configuration
    const baseURL = 'http://localhost:8000'; // Change to your server URL
    const authToken = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token
    
    // Test data
    const gameUid = 'slot_000001';
    const testParams = {
      currency: 'INR',
      language: 'en',
      platform: 'web'
    };
    
    console.log('🎯 Testing Game Launch with Auto-Transfer:');
    console.log('📍 Game UID:', gameUid);
    console.log('💰 Currency:', testParams.currency);
    console.log('🌐 Language:', testParams.language);
    console.log('📱 Platform:', testParams.platform);
    console.log('');
    
    console.log('💡 Expected Behavior:');
    console.log('   1. Check third-party wallet balance');
    console.log('   2. If no balance, auto-transfer from main wallet');
    console.log('   3. Launch game with new balance');
    console.log('');
    
    // Build query string
    const queryString = new URLSearchParams(testParams).toString();
    const url = `${baseURL}/api/casino/games/${gameUid}/launch?${queryString}`;
    
    console.log('🔗 Request URL:', url);
    console.log('');
    
    // Make request
    const response = await axios.post(url, {}, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ Response Status:', response.status);
    console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n🎉 Game Launch with Auto-Transfer Successful!');
      console.log('🎮 Game URL:', response.data.data.gameUrl);
      console.log('🆔 Session ID:', response.data.data.sessionId);
      console.log('👤 Member Account:', response.data.data.memberAccount);
      console.log('💰 Balance:', response.data.data.balance);
      console.log('💱 Currency:', response.data.data.currency);
    } else {
      console.log('\n⚠️  Game Launch Failed:');
      console.log('❌ Message:', response.data.message);
      if (response.data.error) {
        console.log('🔍 Error Details:', response.data.error);
      }
      if (response.data.mainWalletBalance !== undefined) {
        console.log('💰 Main Wallet Balance:', response.data.mainWalletBalance);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Auto-Transfer Test Failed:');
    
    if (error.response) {
      console.error('📡 Response Status:', error.response.status);
      console.error('📦 Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('🌐 Network Error:', error.message);
    } else {
      console.error('💻 Error:', error.message);
    }
  }
}

/**
 * Test Balance Check Before Game Launch
 */
async function testBalanceCheck() {
  try {
    console.log('\n💰 === TESTING BALANCE CHECK ===\n');
    
    const baseURL = 'http://localhost:8000';
    const authToken = 'YOUR_AUTH_TOKEN_HERE';
    
    // Check third-party wallet balance
    const balanceUrl = `${baseURL}/api/third-party-wallet/balance`;
    
    console.log('🔍 Checking third-party wallet balance...');
    console.log('🔗 URL:', balanceUrl);
    
    const balanceResponse = await axios.get(balanceUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    console.log('✅ Balance Check Response:');
    console.log('📦 Data:', JSON.stringify(balanceResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Balance check failed:', error.message);
  }
}

/**
 * Show Auto-Transfer System Details
 */
function showSystemDetails() {
  console.log('\n🔧 === AUTO-TRANSFER SYSTEM DETAILS ===\n');
  
  console.log('🎯 How It Works:');
  console.log('   1. User requests game launch');
  console.log('   2. System checks third-party wallet balance');
  console.log('   3. If balance = 0, auto-transfer from main wallet');
  console.log('   4. Transfer ALL available funds (like Spribe)');
  console.log('   5. Launch game with new balance');
  console.log('');
  
  console.log('💡 Benefits:');
  console.log('   ✅ Seamless user experience');
  console.log('   ✅ No manual transfer needed');
  console.log('   ✅ Full balance available for gaming');
  console.log('   ✅ Automatic wallet management');
  console.log('');
  
  console.log('🔒 Security Features:');
  console.log('   🔐 Transaction-based transfers');
  console.log('   🔐 Balance validation');
  console.log('   🔐 Rollback on failure');
  console.log('   🔐 Comprehensive logging');
  console.log('');
  
  console.log('📊 Transfer Flow:');
  console.log('   Main Wallet → Third-Party Wallet → Game Launch');
  console.log('   (All funds)    (All funds)      (Ready to play)');
}

/**
 * Show Testing Instructions
 */
function showTestingInstructions() {
  console.log('\n🧪 === TESTING INSTRUCTIONS ===\n');
  
  console.log('1️⃣  Prerequisites:');
  console.log('   ✅ Server running on localhost:8000');
  console.log('   ✅ Valid auth token');
  console.log('   ✅ User has main wallet balance');
  console.log('   ✅ Third-party wallet exists');
  console.log('');
  
  console.log('2️⃣  Test Scenarios:');
  console.log('   🎮 Empty third-party wallet → Should auto-transfer');
  console.log('   🎮 Zero main wallet → Should show error');
  console.log('   🎮 Sufficient third-party balance → Should launch directly');
  console.log('');
  
  console.log('3️⃣  Run Tests:');
  console.log('   💻 node test-auto-transfer.js');
  console.log('   📱 Or use Postman with the same endpoint');
  console.log('');
  
  console.log('4️⃣  Expected Results:');
  console.log('   ✅ Auto-transfer logs in console');
  console.log('   ✅ Game launch successful');
  console.log('   ✅ Balance transferred correctly');
  console.log('   ✅ Session created');
}

// Run tests
async function runTests() {
  console.log('🎰 Casino Auto-Transfer System Test Suite\n');
  
  // Show system details
  showSystemDetails();
  
  // Show testing instructions
  showTestingInstructions();
  
  // Test balance check
  await testBalanceCheck();
  
  // Test auto-transfer with game launch
  await testAutoTransfer();
  
  console.log('\n✨ Test Suite Complete!');
  console.log('\n📝 To test with real data:');
  console.log('   1. Get a valid auth token from login');
  console.log('   2. Update the authToken variable in this script');
  console.log('   3. Ensure your server is running');
  console.log('   4. Run: node test-auto-transfer.js');
  console.log('');
  console.log('🎯 The system will now automatically transfer funds');
  console.log('   from main wallet to third-party wallet when needed!');
}

// Export for use in other files
module.exports = {
  testAutoTransfer,
  testBalanceCheck,
  showSystemDetails
};

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}
