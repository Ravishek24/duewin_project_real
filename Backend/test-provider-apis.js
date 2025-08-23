const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api/casino';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

// Test headers
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`
};

/**
 * Test the new provider APIs
 */
async function testProviderAPIs() {
  console.log('🧪 === TESTING CASINO PROVIDER APIS ===\n');

  try {
    // Test 1: Get all providers
    console.log('📋 Test 1: Getting all providers...');
    const providersResponse = await axios.get(`${BASE_URL}/providers`, { headers });
    
    if (providersResponse.data.success) {
      console.log('✅ Providers API Response:');
      console.log(`   Total providers: ${providersResponse.data.data.total}`);
      console.log(`   Source: ${providersResponse.data.data.source}`);
      console.log(`   Message: ${providersResponse.data.data.message}`);
      console.log(`   First 5 providers: ${providersResponse.data.data.providers.slice(0, 5).join(', ')}`);
    } else {
      console.log('❌ Providers API failed:', providersResponse.data.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Get games by specific provider
    console.log('🎮 Test 2: Getting games by specific provider...');
    const testProvider = 'Pragmatic Play';
    const gamesByProviderResponse = await axios.get(`${BASE_URL}/games?provider=${encodeURIComponent(testProvider)}`, { headers });
    
    if (gamesByProviderResponse.data.success) {
      console.log(`✅ Games by Provider (${testProvider}) API Response:`);
      console.log(`   Total games: ${gamesByProviderResponse.data.data.total}`);
      console.log(`   Source: ${gamesByProviderResponse.data.data.source}`);
      console.log(`   Message: ${gamesByProviderResponse.data.data.message}`);
      console.log(`   First 3 games: ${gamesByProviderResponse.data.data.games.slice(0, 3).map(g => g.name).join(', ')}`);
    } else {
      console.log('❌ Games by Provider API failed:', gamesByProviderResponse.data.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: Get games by category
    console.log('🎯 Test 3: Getting games by category...');
    const testCategory = 'slots';
    const gamesByCategoryResponse = await axios.get(`${BASE_URL}/games?category=${testCategory}`, { headers });
    
    if (gamesByCategoryResponse.data.success) {
      console.log(`✅ Games by Category (${testCategory}) API Response:`);
      console.log(`   Total games: ${gamesByCategoryResponse.data.data.total}`);
      console.log(`   Source: ${gamesByCategoryResponse.data.data.source}`);
      console.log(`   Message: ${gamesByCategoryResponse.data.data.message}`);
      console.log(`   First 3 games: ${gamesByCategoryResponse.data.data.games.slice(0, 3).map(g => g.name).join(', ')}`);
    } else {
      console.log('❌ Games by Category API failed:', gamesByCategoryResponse.data.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 4: Get games by provider AND category
    console.log('🎯🎮 Test 4: Getting games by provider AND category...');
    const gamesByProviderAndCategoryResponse = await axios.get(
      `${BASE_URL}/games?provider=${encodeURIComponent(testProvider)}&category=${testCategory}`, 
      { headers }
    );
    
    if (gamesByProviderAndCategoryResponse.data.success) {
      console.log(`✅ Games by Provider (${testProvider}) and Category (${testCategory}) API Response:`);
      console.log(`   Total games: ${gamesByProviderAndCategoryResponse.data.data.total}`);
      console.log(`   Source: ${gamesByProviderAndCategoryResponse.data.data.source}`);
      console.log(`   Message: ${gamesByProviderAndCategoryResponse.data.data.message}`);
      console.log(`   First 3 games: ${gamesByProviderAndCategoryResponse.data.data.games.slice(0, 3).map(g => g.name).join(', ')}`);
    } else {
      console.log('❌ Games by Provider and Category API failed:', gamesByProviderAndCategoryResponse.data.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 5: Search games
    console.log('🔍 Test 5: Searching games...');
    const searchTerm = 'Dragon';
    const searchResponse = await axios.get(`${BASE_URL}/games?search=${encodeURIComponent(searchTerm)}`, { headers });
    
    if (searchResponse.data.success) {
      console.log(`✅ Search Games (${searchTerm}) API Response:`);
      console.log(`   Total games: ${searchResponse.data.data.total}`);
      console.log(`   Source: ${searchResponse.data.data.source}`);
      console.log(`   Message: ${searchResponse.data.data.message}`);
      console.log(`   First 3 games: ${searchResponse.data.data.games.slice(0, 3).map(g => g.name).join(', ')}`);
    } else {
      console.log('❌ Search Games API failed:', searchResponse.data.message);
    }

    console.log('\n🎉 === ALL TESTS COMPLETED ===');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Show API usage examples
 */
function showAPIExamples() {
  console.log('\n📚 === CASINO PROVIDER API USAGE EXAMPLES ===\n');

  console.log('1️⃣ Get All Providers:');
  console.log('   GET /api/casino/providers');
  console.log('   Response: List of all available casino providers\n');

  console.log('2️⃣ Get Games by Specific Provider:');
  console.log('   GET /api/casino/games?provider=Pragmatic Play');
  console.log('   Response: All games from Pragmatic Play\n');

  console.log('3️⃣ Get Games by Category:');
  console.log('   GET /api/casino/games?category=slots');
  console.log('   Response: All slot games\n');

  console.log('4️⃣ Get Games by Provider AND Category:');
  console.log('   GET /api/casino/games?provider=Pragmatic Play&category=slots');
  console.log('   Response: Slot games from Pragmatic Play only\n');

  console.log('5️⃣ Search Games:');
  console.log('   GET /api/casino/games?search=Dragon');
  console.log('   Response: Games with "Dragon" in name or category\n');

  console.log('6️⃣ Combine Multiple Filters:');
  console.log('   GET /api/casino/games?provider=Evolution Gaming&category=live&search=Blackjack');
  console.log('   Response: Live Blackjack games from Evolution Gaming\n');

  console.log('📝 Note: All endpoints require authentication (Bearer token)');
  console.log('📝 Note: The system prioritizes real casino API responses over fallback generation');
}

// Run tests if this file is executed directly
if (require.main === module) {
  showAPIExamples();
  console.log('\n' + '='.repeat(60) + '\n');
  testProviderAPIs();
}

module.exports = {
  testProviderAPIs,
  showAPIExamples
};
