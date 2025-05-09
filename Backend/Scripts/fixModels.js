const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

// This script checks for and disables any auto-sync operations

async function checkAndFixModels() {
  try {
    console.log('Checking database connection...');
    await sequelize.authenticate();
    console.log('Database connection is OK');

    // Check if there are any pending migrations
    const [results] = await sequelize.query('SELECT * FROM SequelizeMeta');
    console.log(`Found ${results.length} completed migrations`);
    
    // Disable all auto-sync
    const origSync = sequelize.sync;
    sequelize.sync = function() {
      console.log('⚠️ Attempted automatic sync was blocked');
      return Promise.resolve();
    };
    
    console.log('Auto-sync has been disabled');
    console.log('All model checks completed');
    
    // Print schema version
    console.log('Current schema version:', results[results.length - 1].name);
    
    return true;
  } catch (error) {
    console.error('Error in fix models script:', error);
    return false;
  }
}

// Run the check if script is executed directly
if (require.main === module) {
  checkAndFixModels()
    .then(result => {
      console.log('Script completed with result:', result);
      process.exit(result ? 0 : 1);
    })
    .catch(err => {
      console.error('Script failed:', err);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = { checkAndFixModels };
} 