'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('Starting transaction table recreation migration');
      // Disable foreign key checks to allow for table recreation
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // Step 1: Drop the tables if they exist
      console.log('Dropping game_transactions table');
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS game_transactions');
      
      console.log('Dropping seamless_transactions table');
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS seamless_transactions');
      
      // Step 2: Create game_transactions table with correct schema
      console.log('Creating game_transactions table');
      await queryInterface.createTable('game_transactions', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'user_id'
          }
        },
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        type: {
          type: Sequelize.ENUM('bet', 'win', 'refund'),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'completed', 'failed'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });
      
      // Add indexes to game_transactions
      console.log('Adding indexes to game_transactions');
      await queryInterface.addIndex('game_transactions', ['user_id']);
      await queryInterface.addIndex('game_transactions', ['type']);
      await queryInterface.addIndex('game_transactions', ['status']);
      
      // Step 3: Create seamless_transactions table with correct schema
      console.log('Creating seamless_transactions table');
      await queryInterface.createTable('seamless_transactions', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'user_id'
          }
        },
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        type: {
          type: Sequelize.ENUM('bet', 'win', 'refund'),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'completed', 'failed'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });
      
      // Add indexes to seamless_transactions
      console.log('Adding indexes to seamless_transactions');
      await queryInterface.addIndex('seamless_transactions', ['user_id']);
      await queryInterface.addIndex('seamless_transactions', ['type']);
      await queryInterface.addIndex('seamless_transactions', ['status']);
      
      // Re-enable foreign key checks
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      
      console.log('Transaction table recreation migration completed successfully');
      return Promise.resolve();
    } catch (error) {
      // Make sure to re-enable foreign key checks even if there's an error
      try {
        await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      } catch (e) {
        // Ignore any error when trying to re-enable foreign keys
      }
      
      console.error('Error in transaction table recreation migration:', error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // This is a destructive migration, but we can provide a basic down function
    // that recreates the tables with minimal structure if needed
    try {
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // Drop tables
      await queryInterface.dropTable('game_transactions');
      await queryInterface.dropTable('seamless_transactions');
      
      // Create minimal tables (this is a best-effort rollback)
      await queryInterface.createTable('game_transactions', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });
      
      await queryInterface.createTable('seamless_transactions', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        game_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      });
      
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      
      return Promise.resolve();
    } catch (error) {
      // Re-enable foreign keys before returning error
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      return Promise.reject(error);
    }
  }
}; 