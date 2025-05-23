// Backend/test-db-save.js
// Test script to manually save a result to each game table

require('dotenv').config();
const { sequelize } = require('./config/db');
const BetResultWingo = require('./models/BetResultWingo');
const BetResult5D = require('./models/BetResult5D');
const BetResultK3 = require('./models/BetResultK3');
const BetResultTrxWix = require('./models/BetResultTrxWix');
const { v4: uuidv4 } = require('uuid');

// Get current date in YYYYMMDD format
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const dateStr = `${year}${month}${day}`;

// Set proper period IDs with the correct format
const basePeriodId = `${dateStr}000000000`;  // yyyymmdd followed by 9 zeros
const testPeriodIds = {
  wingo: `${dateStr}000000001`,
  fiveD: `${dateStr}000000002`,
  k3: `${dateStr}000000003`,
  trxWix: `${dateStr}000000004`
};

console.log('Using period IDs format:', basePeriodId, '(incremented for each game)');

async function testWingoSave() {
  try {
    console.log('Testing BetResultWingo save...');
    const record = await BetResultWingo.create({
      bet_number: testPeriodIds.wingo,
      result_of_number: 7,
      result_of_size: 'Big',
      result_of_color: 'green',
      time: 60
    });
    console.log('✅ BetResultWingo saved successfully, ID:', record.bet_id);
    return true;
  } catch (error) {
    console.error('❌ BetResultWingo save failed:', error.message);
    return false;
  }
}

async function test5DSave() {
  try {
    console.log('Testing BetResult5D save...');
    const record = await BetResult5D.create({
      bet_number: testPeriodIds.fiveD,
      result_a: 1,
      result_b: 2,
      result_c: 3,
      result_d: 4,
      result_e: 5,
      total_sum: 15,
      time: 60
    });
    console.log('✅ BetResult5D saved successfully, ID:', record.bet_id);
    return true;
  } catch (error) {
    console.error('❌ BetResult5D save failed:', error.message);
    return false;
  }
}

async function testK3Save() {
  try {
    console.log('Testing BetResultK3 save...');
    const record = await BetResultK3.create({
      bet_number: testPeriodIds.k3,
      dice_1: 1,
      dice_2: 2,
      dice_3: 3,
      sum: 6,
      has_pair: false,
      has_triple: false,
      is_straight: true,
      sum_size: 'small',
      sum_parity: 'even',
      time: 60
    });
    console.log('✅ BetResultK3 saved successfully, ID:', record.bet_id);
    return true;
  } catch (error) {
    console.error('❌ BetResultK3 save failed:', error.message);
    return false;
  }
}

async function testTrxWixSave() {
  try {
    console.log('Testing BetResultTrxWix save...');
    const record = await BetResultTrxWix.create({
      result_id: uuidv4(),
      period: testPeriodIds.trxWix,
      result: {number: 7, color: 'green', size: 'Big'},
      verification_hash: 'test-hash-' + Date.now(),
      verification_link: 'https://example.com/test'
    });
    console.log('✅ BetResultTrxWix saved successfully, ID:', record.result_id);
    return true;
  } catch (error) {
    console.error('❌ BetResultTrxWix save failed:', error.message);
    console.error('Details:', error);
    return false;
  }
}

async function runTests() {
  try {
    console.log('Testing database connections and model configurations...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Run all tests
    const wingoResult = await testWingoSave();
    const fiveDResult = await test5DSave();
    const k3Result = await testK3Save();
    const trxWixResult = await testTrxWixSave();
    
    // Report results
    console.log('\n=== TEST RESULTS ===');
    console.log(`Wingo: ${wingoResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`5D: ${fiveDResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`K3: ${k3Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`TrxWix: ${trxWixResult ? '✅ PASS' : '❌ FAIL'}`);
    
    // Close the connection
    await sequelize.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
runTests(); 