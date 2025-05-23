require('dotenv').config();
const sequelize = require('../config/db').sequelize;
const BetResultWingo = require('../models/BetResultWingo');
const BetResult5D = require('../models/BetResult5D');
const BetResultK3 = require('../models/BetResultK3');

/**
 * Utility script to check the latest game results
 */
async function checkLatestResults() {
  try {
    console.log("Checking latest game results...\n");

    // Check Wingo results
    console.log("=== WINGO RESULTS ===");
    const wingoResults = await BetResultWingo.findAll({
      order: [['bet_id', 'DESC']],
      limit: 5
    });

    if (wingoResults.length === 0) {
      console.log("No Wingo results found");
    } else {
      wingoResults.forEach(result => {
        console.log(`Period: ${result.bet_number}`);
        console.log(`Number: ${result.result_of_number}`);
        console.log(`Color: ${result.result_of_color}`);
        console.log(`Size: ${result.result_of_size}`);
        console.log(`Time: ${result.time}s`);
        console.log(`Created: ${result.created_at}`);
        console.log("---");
      });
    }

    // Check 5D results
    console.log("\n=== 5D RESULTS ===");
    const fiveDResults = await BetResult5D.findAll({
      order: [['bet_id', 'DESC']],
      limit: 5
    });

    if (fiveDResults.length === 0) {
      console.log("No 5D results found");
    } else {
      fiveDResults.forEach(result => {
        console.log(`Period: ${result.bet_number}`);
        console.log(`Numbers: ${result.result_a}, ${result.result_b}, ${result.result_c}, ${result.result_d}, ${result.result_e}`);
        console.log(`Sum: ${result.total_sum}`);
        console.log(`Time: ${result.time}s`);
        console.log(`Created: ${result.created_at}`);
        console.log("---");
      });
    }

    // Check K3 results
    console.log("\n=== K3 RESULTS ===");
    const k3Results = await BetResultK3.findAll({
      order: [['bet_id', 'DESC']],
      limit: 5
    });

    if (k3Results.length === 0) {
      console.log("No K3 results found");
    } else {
      k3Results.forEach(result => {
        console.log(`Period: ${result.bet_number}`);
        console.log(`Dice: ${result.dice_1}, ${result.dice_2}, ${result.dice_3}`);
        console.log(`Sum: ${result.sum}`);
        console.log(`Has Pair: ${result.has_pair ? 'Yes' : 'No'}`);
        console.log(`Has Triple: ${result.has_triple ? 'Yes' : 'No'}`);
        console.log(`Is Straight: ${result.is_straight ? 'Yes' : 'No'}`);
        console.log(`Size: ${result.sum_size}`);
        console.log(`Parity: ${result.sum_parity}`);
        console.log(`Time: ${result.time}s`);
        console.log(`Created: ${result.created_at}`);
        console.log("---");
      });
    }

  } catch (error) {
    console.error("Error checking latest results:", error);
  } finally {
    await sequelize.close();
  }
}

// Run the function
checkLatestResults(); 