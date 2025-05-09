const { sequelize } = require('../config/db');
const { checkAndFixModels } = require('./fixModels');

async function prepareDatabase() {
  try {
    console.log('Preparing database for app startup...');
    
    // Ensure connection
    await sequelize.authenticate();
    
    // Disable foreign key checks temporarily
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Check and fix game_transactions and seamless_transactions tables
    console.log('Checking for problematic session_id columns...');
    
    // Check and drop the session_id column from game_transactions if it exists
    const [hasGameSessionId] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'game_transactions' 
      AND COLUMN_NAME = 'session_id'
    `);
    
    if (hasGameSessionId[0].count > 0) {
      console.log('Found session_id in game_transactions, dropping it');
      await sequelize.query(`
        ALTER TABLE game_transactions 
        DROP FOREIGN KEY IF EXISTS game_transactions_session_id_foreign_idx
      `).catch(e => console.log('No foreign key to drop, continuing'));
      
      await sequelize.query(`
        ALTER TABLE game_transactions DROP COLUMN session_id
      `);
      console.log('✓ Dropped session_id column from game_transactions');
    }
    
    // Check and drop the session_id column from seamless_transactions if it exists
    const [hasSeamlessSessionId] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'seamless_transactions' 
      AND COLUMN_NAME = 'session_id'
    `);
    
    if (hasSeamlessSessionId[0].count > 0) {
      console.log('Found session_id in seamless_transactions, dropping it');
      await sequelize.query(`
        ALTER TABLE seamless_transactions 
        DROP FOREIGN KEY IF EXISTS seamless_transactions_session_id_foreign_idx
      `).catch(e => console.log('No foreign key to drop, continuing'));
      
      await sequelize.query(`
        ALTER TABLE seamless_transactions DROP COLUMN session_id
      `);
      console.log('✓ Dropped session_id column from seamless_transactions');
    }
    
    // Re-enable foreign keys
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    
    // Run model fixes
    await checkAndFixModels();
    
    console.log('Database preparation completed successfully');
    return true;
  } catch (error) {
    // Make sure to re-enable foreign keys even if there's an error
    try {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (e) {
      // Ignore errors re-enabling foreign keys
    }
    
    console.error('Error preparing database:', error);
    return false;
  }
}

// Run the preparation if script is executed directly
if (require.main === module) {
  prepareDatabase()
    .then(result => {
      console.log('Database preparation complete, result:', result);
      process.exit(result ? 0 : 1);
    })
    .catch(err => {
      console.error('Database preparation failed:', err);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = { prepareDatabase };
} 