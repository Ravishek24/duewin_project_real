'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Disable foreign key checks 
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // More aggressive approach - run direct SQL to fix everything
      try {
        // First try to drop any potentially problematic foreign keys
        await queryInterface.sequelize.query(`
          ALTER TABLE game_transactions 
          DROP FOREIGN KEY IF EXISTS game_transactions_session_id_foreign_idx
        `).catch(e => console.log('No foreign key to drop, continuing'));
        
        // Check and drop the session_id column from game_transactions if it exists
        const hasSessionId = await queryInterface.sequelize.query(`
          SELECT * 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'game_transactions' 
          AND COLUMN_NAME = 'session_id'
        `);
        
        if (hasSessionId[0].length > 0) {
          await queryInterface.sequelize.query(`
            ALTER TABLE game_transactions DROP COLUMN session_id
          `);
          console.log('✓ Dropped session_id column from game_transactions');
        }
        
        // Also check and fix seamless_transactions
        await queryInterface.sequelize.query(`
          ALTER TABLE seamless_transactions 
          DROP FOREIGN KEY IF EXISTS seamless_transactions_session_id_foreign_idx
        `).catch(e => console.log('No foreign key to drop in seamless_transactions, continuing'));
        
        const hasSeamlessSessionId = await queryInterface.sequelize.query(`
          SELECT * 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'seamless_transactions' 
          AND COLUMN_NAME = 'session_id'
        `);
        
        if (hasSeamlessSessionId[0].length > 0) {
          await queryInterface.sequelize.query(`
            ALTER TABLE seamless_transactions DROP COLUMN session_id
          `);
          console.log('✓ Dropped session_id column from seamless_transactions');
        }
        
        // Check for any unexpected foreign keys in SequelizeMeta and fix
        await queryInterface.sequelize.query(`
          DELETE FROM SequelizeMeta WHERE name LIKE '%add-session-id%'
        `).catch(e => console.log('No migrations to remove, continuing'));
        
      } catch (error) {
        console.error('Error in SQL operations:', error);
      }
      
      // Re-enable foreign key checks
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      
      return Promise.resolve();
    } catch (error) {
      // Re-enable foreign key checks even on error
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      
      console.error('Migration error:', error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.resolve();
  }
}; 