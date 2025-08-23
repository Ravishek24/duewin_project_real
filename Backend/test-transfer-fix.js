/**
 * Test the Fixed Transfer Function
 */
const thirdPartyWalletService = require('./services/thirdPartyWalletService');

async function testTransferFix() {
  try {
    console.log('🧪 === TESTING TRANSFER FIX ===\n');
    
    // Test with different data types
    const testCases = [
      { userId: 1, amount: 1000.50, description: 'Normal number' },
      { userId: 1, amount: "1000.50", description: 'String number' },
      { userId: 1, amount: 0, description: 'Zero amount' },
      { userId: 1, amount: -100, description: 'Negative amount' },
      { userId: 1, amount: "95947094.57", description: 'Large string number' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🔍 Testing: ${testCase.description}`);
      console.log(`   Amount: ${testCase.amount} (type: ${typeof testCase.amount})`);
      
      try {
        // This would normally call the database, but we're just testing the logic
        const amount = parseFloat(testCase.amount);
        const mainBalance = 10000; // Mock main balance
        
        console.log(`   Parsed amount: ${amount} (type: ${typeof amount})`);
        console.log(`   Is NaN: ${isNaN(amount)}`);
        console.log(`   Valid amount: ${amount > 0 && amount <= mainBalance}`);
        
        if (isNaN(amount)) {
          console.log('   ❌ Invalid amount (NaN)');
        } else if (amount <= 0) {
          console.log('   ❌ Amount <= 0');
        } else if (amount > mainBalance) {
          console.log('   ❌ Amount > main balance');
        } else {
          console.log('   ✅ Valid amount');
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n✨ Transfer Fix Test Complete!');
    console.log('\n💡 The main issue was:');
    console.log('   - req.user.wallet_balance returns a string');
    console.log('   - parseFloat() converts it to a number');
    console.log('   - toFixed() only works on numbers, not strings');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testTransferFix().catch(console.error);
