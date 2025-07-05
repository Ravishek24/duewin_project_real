const { mapClientBetValue, mapClientBetType, calculateOddsForBet } = require('../services/websocketService');

function testBetValidationFix() {
  console.log('🧪 Testing Bet Validation Fix\n');

  // Test cases with different input types
  const testCases = [
    // K3 game - sum bet with number
    { gameType: 'k3', type: 'sum', selection: 4, description: 'K3 sum bet with number 4' },
    { gameType: 'k3', type: 'sum', selection: '4', description: 'K3 sum bet with string "4"' },
    
    // Wingo game - color bet with string
    { gameType: 'wingo', type: 'color', selection: 'red', description: 'Wingo color bet with string "red"' },
    { gameType: 'wingo', type: 'color', selection: 'RED', description: 'Wingo color bet with uppercase "RED"' },
    
    // Wingo game - size bet with string
    { gameType: 'wingo', type: 'size', selection: 'big', description: 'Wingo size bet with string "big"' },
    { gameType: 'wingo', type: 'size', selection: 'BIG', description: 'Wingo size bet with uppercase "BIG"' },
    
    // Wingo game - parity bet with string
    { gameType: 'wingo', type: 'parity', selection: 'odd', description: 'Wingo parity bet with string "odd"' },
    { gameType: 'wingo', type: 'parity', selection: 'EVEN', description: 'Wingo parity bet with uppercase "EVEN"' },
    
    // Edge cases
    { gameType: 'wingo', type: 'color', selection: null, description: 'Wingo color bet with null' },
    { gameType: 'wingo', type: 'color', selection: undefined, description: 'Wingo color bet with undefined' },
    { gameType: 'wingo', type: 'color', selection: '', description: 'Wingo color bet with empty string' },
  ];

  console.log('Testing mapClientBetValue function:');
  console.log('=====================================');
  
  testCases.forEach((testCase, index) => {
    try {
      const result = mapClientBetValue(testCase.selection, testCase.type);
      console.log(`✅ Test ${index + 1}: ${testCase.description}`);
      console.log(`   Input: selection=${testCase.selection} (${typeof testCase.selection}), type=${testCase.type}`);
      console.log(`   Output: ${result}`);
      console.log('');
    } catch (error) {
      console.log(`❌ Test ${index + 1}: ${testCase.description}`);
      console.log(`   Input: selection=${testCase.selection} (${typeof testCase.selection}), type=${testCase.type}`);
      console.log(`   Error: ${error.message}`);
      console.log('');
    }
  });

  console.log('Testing mapClientBetType function:');
  console.log('===================================');
  
  const typeTestCases = [
    { type: 'sum', description: 'Sum bet type' },
    { type: 'color', description: 'Color bet type' },
    { type: 'COLOR', description: 'Uppercase color bet type' },
    { type: 123, description: 'Number bet type' },
    { type: null, description: 'Null bet type' },
    { type: undefined, description: 'Undefined bet type' },
  ];

  typeTestCases.forEach((testCase, index) => {
    try {
      const result = mapClientBetType(testCase.type);
      console.log(`✅ Test ${index + 1}: ${testCase.description}`);
      console.log(`   Input: type=${testCase.type} (${typeof testCase.type})`);
      console.log(`   Output: ${result}`);
      console.log('');
    } catch (error) {
      console.log(`❌ Test ${index + 1}: ${testCase.description}`);
      console.log(`   Input: type=${testCase.type} (${typeof testCase.type})`);
      console.log(`   Error: ${error.message}`);
      console.log('');
    }
  });

  console.log('Testing calculateOddsForBet function:');
  console.log('=====================================');
  
  const oddsTestCases = [
    { type: 'sum', selection: 4, description: 'Sum bet with number 4' },
    { type: 'sum', selection: '4', description: 'Sum bet with string "4"' },
    { type: 'color', selection: 'red', description: 'Color bet with "red"' },
    { type: 'color', selection: 'violet', description: 'Color bet with "violet"' },
    { type: 'size', selection: 'big', description: 'Size bet with "big"' },
    { type: 'parity', selection: 'odd', description: 'Parity bet with "odd"' },
  ];

  oddsTestCases.forEach((testCase, index) => {
    try {
      const result = calculateOddsForBet(testCase.type, testCase.selection);
      console.log(`✅ Test ${index + 1}: ${testCase.description}`);
      console.log(`   Input: type=${testCase.type}, selection=${testCase.selection} (${typeof testCase.selection})`);
      console.log(`   Output: ${result}`);
      console.log('');
    } catch (error) {
      console.log(`❌ Test ${index + 1}: ${testCase.description}`);
      console.log(`   Input: type=${testCase.type}, selection=${testCase.selection} (${typeof testCase.selection})`);
      console.log(`   Error: ${error.message}`);
      console.log('');
    }
  });

  console.log('🎯 Summary:');
  console.log('All bet validation functions should now handle both string and number inputs correctly.');
  console.log('The original error "clientSelection?.toLowerCase is not a function" should be resolved.');
}

// Run the test
if (require.main === module) {
  testBetValidationFix();
}

module.exports = { testBetValidationFix }; 