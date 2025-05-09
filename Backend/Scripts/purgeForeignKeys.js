const { sequelize } = require('../config/db');

/**
 * A script to purge any foreign key constraints related to session_id
 * This is a last-resort measure to fix persistent foreign key issues
 */
async function purgeForeignKeys() {
  try {
    console.log('Running foreign key purge script');
    
    // Disable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Get all foreign keys in the database
    const [foreignKeys] = await sequelize.query(`
      SELECT TABLE_NAME, CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_TYPE = 'FOREIGN KEY'
      AND TABLE_SCHEMA = DATABASE()
    `);
    
    console.log(`Found ${foreignKeys.length} foreign key constraints in database`);
    
    // Filter for problematic foreign keys
    const problematicKeys = foreignKeys.filter(fk => {
      return (
        (fk.TABLE_NAME === 'game_transactions' && fk.CONSTRAINT_NAME.includes('session_id')) ||
        (fk.TABLE_NAME === 'seamless_transactions' && fk.CONSTRAINT_NAME.includes('session_id'))
      );
    });
    
    if (problematicKeys.length > 0) {
      console.log(`Found ${problematicKeys.length} problematic foreign keys to purge`);
      
      // Drop each problematic foreign key
      for (const fk of problematicKeys) {
        console.log(`Dropping foreign key ${fk.CONSTRAINT_NAME} from ${fk.TABLE_NAME}`);
        
        await sequelize.query(`
          ALTER TABLE ${fk.TABLE_NAME}
          DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}
        `);
      }
      
      console.log('All problematic foreign keys have been dropped');
    } else {
      console.log('No problematic foreign keys found');
    }
    
    // Check for and drop session_id columns
    console.log('Checking for session_id columns in transaction tables');
    
    // Check game_transactions table
    const [gameTransColumns] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'game_transactions'
      AND COLUMN_NAME = 'session_id'
    `);
    
    if (gameTransColumns.length > 0) {
      console.log('Found session_id column in game_transactions, dropping it');
      
      await sequelize.query(`
        ALTER TABLE game_transactions
        DROP COLUMN session_id
      `);
      
      console.log('✓ Dropped session_id column from game_transactions');
    }
    
    // Check seamless_transactions table
    const [seamlessTransColumns] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seamless_transactions'
      AND COLUMN_NAME = 'session_id'
    `);
    
    if (seamlessTransColumns.length > 0) {
      console.log('Found session_id column in seamless_transactions, dropping it');
      
      await sequelize.query(`
        ALTER TABLE seamless_transactions
        DROP COLUMN session_id
      `);
      
      console.log('✓ Dropped session_id column from seamless_transactions');
    }
    
    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('Foreign key purge script completed successfully');
    return true;
  } catch (error) {
    // Re-enable foreign key checks even on error
    try {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (e) {
      // Ignore error re-enabling foreign keys
    }
    
    console.error('Error in foreign key purge script:', error);
    return false;
  }
}

// Run the script directly if called from command line
if (require.main === module) {
  purgeForeignKeys()
    .then(result => {
      console.log('Foreign key purge script result:', result);
      process.exit(result ? 0 : 1);
    })
    .catch(error => {
      console.error('Foreign key purge script failed with error:', error);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = { purgeForeignKeys };
} 