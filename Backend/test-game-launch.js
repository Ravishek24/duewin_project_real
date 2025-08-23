const axios = require('axios');

/**
 * Test Casino Game Launch API
 */
async function testGameLaunch() {
  try {
    console.log('🎮 === TESTING CASINO GAME LAUNCH ===\n');
    
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
    
    console.log('🎯 Testing Game Launch:');
    console.log('📍 Game UID:', gameUid);
    console.log('💰 Currency:', testParams.currency);
    console.log('🌐 Language:', testParams.language);
    console.log('📱 Platform:', testParams.platform);
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
      console.log('\n🎉 Game Launch Successful!');
      console.log('🎮 Game URL:', response.data.data.gameUrl);
      console.log('🆔 Session ID:', response.data.data.sessionId);
      console.log('👤 Member Account:', response.data.data.memberAccount);
      console.log('💰 Balance:', response.data.data.balance);
      console.log('💱 Currency:', response.data.data.currency);
    }
    
  } catch (error) {
    console.error('\n❌ Game Launch Test Failed:');
    
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
 * Test with different game types
 */
async function testMultipleGames() {
  console.log('\n🎲 === TESTING MULTIPLE GAME TYPES ===\n');
  
  const games = [
    { uid: 'slot_000001', name: 'Slot Game' },
    { uid: 'table_000001', name: 'Table Game' },
    { uid: 'live_000001', name: 'Live Game' },
    { uid: 'arcade_000001', name: 'Arcade Game' }
  ];
  
  for (const game of games) {
    console.log(`🎮 Testing ${game.name} (${game.uid})...`);
    
    try {
      // This would require actual authentication token
      console.log('⚠️  Skipping actual API call (need valid auth token)');
      console.log('📍 Would call: POST /api/casino/games/' + game.uid + '/launch');
      console.log('');
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

/**
 * Show usage examples
 */
function showUsageExamples() {
  console.log('\n📚 === GAME LAUNCH USAGE EXAMPLES ===\n');
  
  console.log('1️⃣  Launch a Slot Game:');
  console.log('   POST /api/casino/games/slot_000001/launch?currency=INR');
  console.log('');
  
  console.log('2️⃣  Launch with Custom Language:');
  console.log('   POST /api/casino/games/table_000001/launch?language=es&currency=INR');
  console.log('');
  
  console.log('3️⃣  Launch on Mobile Platform:');
  console.log('   POST /api/casino/games/live_000001/launch?platform=mobile&currency=INR');
  console.log('');
  
  console.log('4️⃣  Launch with All Parameters:');
  console.log('   POST /api/casino/games/arcade_000001/launch?currency=INR&language=en&platform=web');
  console.log('');
  
  console.log('🔑 Required Headers:');
  console.log('   Authorization: Bearer YOUR_AUTH_TOKEN');
  console.log('   Content-Type: application/json');
  console.log('');
  
  console.log('💡 Tips:');
  console.log('   - Ensure user has balance in third-party wallet');
  console.log('   - Game UID must exist in game list');
  console.log('   - Currency defaults to INR if not specified');
  console.log('   - Language defaults to "en" if not specified');
  console.log('   - Platform defaults to "web" if not specified');
}

// Run tests
async function runTests() {
  console.log('🎰 Casino Game Launch API Test Suite\n');
  
  // Show usage examples first
  showUsageExamples();
  
  // Test single game launch (requires valid auth token)
  await testGameLaunch();
  
  // Test multiple game types
  await testMultipleGames();
  
  console.log('\n✨ Test Suite Complete!');
  console.log('\n📝 To test with real data:');
  console.log('   1. Get a valid auth token from login');
  console.log('   2. Update the authToken variable in this script');
  console.log('   3. Ensure your server is running');
  console.log('   4. Run: node test-game-launch.js');
}

// Export for use in other files
module.exports = {
  testGameLaunch,
  testMultipleGames,
  showUsageExamples
};

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}
