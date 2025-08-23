const axios = require('axios');
const crypto = require('crypto');

/**
 * Debug Casino API - Test Exact Payload Format
 */
async function debugCasinoAPI() {
  try {
    console.log('🔍 === DEBUGGING CASINO API ===\n');
    
    // Configuration
    const config = {
      agency_uid: '3bf0f8fe664844ba7dba29859ba90748',
      aes_key: '68b074393ec7c5a975856a90bd6fdf47',
      server_url: 'https://jsgame.live',
      endpoint: '/game/v1'
    };
    
    console.log('📊 Config:', config);
    console.log('');
    
    // Test different payload structures
    const testCases = [
      {
        name: 'Case 1: Minimal Required Fields Only',
        payload: {
          member_account: 'killerman',
          game_uid: 'slot_000013',
          credit_amount: '1000.00'
        }
      },
      {
        name: 'Case 2: With Currency',
        payload: {
          member_account: 'killerman',
          game_uid: 'slot_000013',
          credit_amount: '1000.00',
          currency_code: 'EUR'
        }
      },
      {
        name: 'Case 3: With All Optional Fields',
        payload: {
          member_account: 'killerman',
          game_uid: 'slot_000013',
          credit_amount: '1000.00',
          currency_code: 'EUR',
          language: 'en',
          home_url: 'https://duewingame-three.vercel.app',
          platform: 'web',
          callback_url: 'https://api.strikecolor1.com/api/casino/callback'
        }
      },
      {
        name: 'Case 4: Different Member Account Format',
        payload: {
          member_account: 'casino_killerman',
          game_uid: 'slot_000013',
          credit_amount: '1000.00',
          currency_code: 'EUR'
        }
      },
      {
        name: 'Case 5: Integer Amount',
        payload: {
          member_account: 'killerman',
          game_uid: 'slot_000013',
          credit_amount: '1000',
          currency_code: 'EUR'
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🔄 Testing: ${testCase.name}`);
      console.log('   Payload:', JSON.stringify(testCase.payload, null, 2));
      
      try {
        // Encrypt payload using modern method
        const key = Buffer.from(config.aes_key, 'hex');
        const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
        
        const dataString = JSON.stringify(testCase.payload);
        let encrypted = cipher.update(dataString, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        // Create request body exactly as API expects
        const requestBody = {
          agency_uid: config.agency_uid,
          timestamp: Date.now().toString(),
          payload: encrypted
        };
        
        console.log('   🔐 Request Body:', {
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
            timeout: 15000
          }
        );
        
        console.log('   ✅ SUCCESS! Response:', response.data);
        
        // If this works, we found the solution!
        console.log('\n🎉 SOLUTION FOUND!');
        console.log(`   Working payload: ${testCase.name}`);
        console.log('   Use this exact structure in your casino service.');
        return;
        
      } catch (error) {
        console.log('   ❌ FAILED:', error.response?.data || error.message);
        
        if (error.response?.data?.code === 10004) {
          console.log('   💡 Same "payload error" - checking next format...');
        }
      }
    }
    
    console.log('\n❌ All test cases failed');
    console.log('💡 The API might expect a different structure or encryption method');
    console.log('💡 Check if the API documentation has changed');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run debug
debugCasinoAPI().catch(console.error);
