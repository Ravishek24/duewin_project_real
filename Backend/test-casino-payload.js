const axios = require('axios');
const crypto = require('crypto');

/**
 * Test Casino API Payload Formats
 * This script helps debug payload issues with the casino API
 */
async function testCasinoPayload() {
  try {
    console.log('🧪 === TESTING CASINO API PAYLOAD FORMATS ===\n');
    
    // Configuration (use your actual values)
    const config = {
      agency_uid: '3bf0f8fe664844ba7dba29859ba90748', // From your logs
      aes_key: '68b074393ec7c5a975856a90bd6fdf47', // From your config
      server_url: 'https://jsgame.live',
      endpoint: '/game/v1'
    };
    
    // Test data
    const testData = {
      user_name: 'killerman',
      balance: 95947094.57,
      wallet_currency: 'EUR',
      game_uid: 'slot_000013'
    };
    
    console.log('📊 Test Data:');
    console.log('   User:', testData.user_name);
    console.log('   Balance:', testData.balance);
    console.log('   Currency:', testData.wallet_currency);
    console.log('   Game UID:', testData.game_uid);
    console.log('');
    
    // Test different payload formats
    const payloadFormats = [
      {
        name: 'Format 1: Original',
        payload: {
          agency_uid: config.agency_uid,
          member_account: testData.user_name,
          game_uid: testData.game_uid,
          timestamp: Date.now().toString(),
          credit_amount: testData.balance.toFixed(2),
          currency_code: testData.wallet_currency,
          language: 'en',
          home_url: 'https://duewingame-three.vercel.app',
          platform: 'web',
          callback_url: 'https://api.strikecolor1.com/api/casino/callback'
        }
      },
      {
        name: 'Format 2: With Prefix + Integer Amount',
        payload: {
          agency_uid: config.agency_uid,
          member_account: `casino_${testData.user_name}`,
          game_uid: testData.game_uid,
          timestamp: Date.now().toString(),
          credit_amount: Math.floor(testData.balance).toString(),
          currency_code: testData.wallet_currency,
          language: 'en',
          home_url: 'https://duewingame-three.vercel.app',
          platform: 'web',
          callback_url: 'https://api.strikecolor1.com/api/casino/callback'
        }
      },
      {
        name: 'Format 3: With Prefix + Decimal + INR',
        payload: {
          agency_uid: config.agency_uid,
          member_account: `casino_${testData.user_name}`,
          game_uid: testData.game_uid,
          timestamp: Date.now().toString(),
          credit_amount: testData.balance.toFixed(2),
          currency_code: 'INR',
          language: 'en',
          home_url: 'https://duewingame-three.vercel.app',
          platform: 'web',
          callback_url: 'https://api.strikecolor1.com/api/casino/callback'
        }
      },
      {
        name: 'Format 4: Minimal Required Fields',
        payload: {
          agency_uid: config.agency_uid,
          member_account: testData.user_name,
          game_uid: testData.game_uid,
          timestamp: Date.now().toString(),
          credit_amount: testData.balance.toFixed(2),
          currency_code: testData.wallet_currency
        }
      }
    ];
    
    // Test each format
    for (const format of payloadFormats) {
      console.log(`\n🔄 Testing: ${format.name}`);
      console.log('   Payload:', JSON.stringify(format.payload, null, 2));
      
      try {
        // Encrypt payload
        const encryptedPayload = encryptPayload(format.payload, config.aes_key);
        const requestBody = {
          agency_uid: config.agency_uid,
          timestamp: format.payload.timestamp,
          payload: encryptedPayload
        };
        
        console.log('   🔐 Encrypted request structure:', {
          agency_uid: requestBody.agency_uid,
          timestamp: requestBody.timestamp,
          payload_length: requestBody.payload.length
        });
        
        // Make API call
        const response = await axios.post(
          `${config.server_url}${config.endpoint}`,
          requestBody,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          }
        );
        
        console.log('   ✅ SUCCESS! Response:', response.data);
        
        // If this format works, we found the solution
        console.log('\n🎉 SOLUTION FOUND!');
        console.log(`   Working format: ${format.name}`);
        console.log('   Use this payload structure in your casino service.');
        return;
        
      } catch (error) {
        console.log('   ❌ FAILED:', error.response?.data || error.message);
        
        if (error.response?.data?.code === 10004) {
          console.log('   💡 This is the same "payload error" you\'re getting');
        }
      }
    }
    
    console.log('\n❌ All payload formats failed');
    console.log('💡 Check the casino API documentation for correct payload structure');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Simple encryption function for testing
 */
function encryptPayload(payload, aesKey) {
  try {
    const dataString = JSON.stringify(payload);
    const cipher = crypto.createCipher('aes-256-ecb', aesKey);
    let encrypted = cipher.update(dataString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

// Run test
testCasinoPayload().catch(console.error);
