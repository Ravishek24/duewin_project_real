// Backend/check-results.js
// Script to check if game results are being saved in the database

require('dotenv').config();
const { sequelize } = require('./config/db');
const Sequelize = require('sequelize'); 
const BetResultWingo = require('./models/BetResultWingo');
const BetResult5D = require('./models/BetResult5D');
const BetResultK3 = require('./models/BetResultK3'); 
const BetResultTrxWix = require('./models/BetResultTrxWix');
const Op = Sequelize.Op;

async function checkResults() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Get count of results for each game type
    const wingoCount = await BetResultWingo.count();
    const fiveDCount = await BetResult5D.count();
    const k3Count = await BetResultK3.count();
    const trxWixCount = await BetResultTrxWix.count();

    console.log('=== Game Results Count ===');
    console.log(`Wingo: ${wingoCount} results`);
    console.log(`5D: ${fiveDCount} results`);
    console.log(`K3: ${k3Count} results`);
    console.log(`TrxWix: ${trxWixCount} results`);

    // Check most recent results for each game type
    if (wingoCount > 0) {
      const latestWingo = await BetResultWingo.findOne({ order: [['created_at', 'DESC']] });
      console.log('\nLatest Wingo result:');
      console.log(`- Period ID: ${latestWingo.bet_number}`);
      console.log(`- Result: Number=${latestWingo.result_of_number}, Color=${latestWingo.result_of_color}, Size=${latestWingo.result_of_size}`);
      console.log(`- Created at: ${latestWingo.created_at}`);
    }

    if (fiveDCount > 0) {
      const latest5D = await BetResult5D.findOne({ order: [['created_at', 'DESC']] });
      console.log('\nLatest 5D result:');
      console.log(`- Period ID: ${latest5D.bet_number}`);
      console.log(`- Result: A=${latest5D.result_a}, B=${latest5D.result_b}, C=${latest5D.result_c}, D=${latest5D.result_d}, E=${latest5D.result_e}`);
      console.log(`- Created at: ${latest5D.created_at}`);
    }

    if (k3Count > 0) {
      const latestK3 = await BetResultK3.findOne({ order: [['created_at', 'DESC']] });
      console.log('\nLatest K3 result:');
      console.log(`- Period ID: ${latestK3.bet_number}`);
      console.log(`- Result: Dice1=${latestK3.dice_1}, Dice2=${latestK3.dice_2}, Dice3=${latestK3.dice_3}, Sum=${latestK3.sum}`);
      console.log(`- Created at: ${latestK3.created_at}`);
    }

    if (trxWixCount > 0) {
      const latestTrxWix = await BetResultTrxWix.findOne({ order: [['created_at', 'DESC']] });
      console.log('\nLatest TrxWix result:');
      console.log(`- Period ID: ${latestTrxWix.period}`);
      console.log(`- Result: ${JSON.stringify(latestTrxWix.result)}`);
      console.log(`- Created at: ${latestTrxWix.created_at}`);
    }

    // Check if new results are being added by comparing timestamps
    console.log('\nChecking for new results in the past 5 minutes...');
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const recentWingo = await BetResultWingo.count({
      where: {
        created_at: {
          [Op.gte]: fiveMinutesAgo
        }
      }
    });

    const recentFiveD = await BetResult5D.count({
      where: {
        created_at: {
          [Op.gte]: fiveMinutesAgo
        }
      }
    });

    const recentK3 = await BetResultK3.count({
      where: {
        created_at: {
          [Op.gte]: fiveMinutesAgo
        }
      }
    });

    const recentTrxWix = await BetResultTrxWix.count({
      where: sequelize.literal(`created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)`)
    });

    console.log(`Recent Wingo results (last 5 min): ${recentWingo}`);
    console.log(`Recent 5D results (last 5 min): ${recentFiveD}`);
    console.log(`Recent K3 results (last 5 min): ${recentK3}`);
    console.log(`Recent TrxWix results (last 5 min): ${recentTrxWix}`);

    await sequelize.close();
    console.log('\nDatabase connection closed.');
  } catch (error) {
    console.error('Error checking results:', error);
  }
}

// Run the check
checkResults(); 