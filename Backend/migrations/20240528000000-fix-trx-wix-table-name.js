'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // First check if the table exists
      const tableExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('bet_result_trx_wix'));

      if (tableExists) {
        // Add missing columns if they don't exist
        const tableInfo = await queryInterface.describeTable('bet_result_trx_wix');
        
        if (!tableInfo.timeline) {
          await queryInterface.addColumn('bet_result_trx_wix', 'timeline', {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'default'
          });
          console.log('Successfully added timeline column');
        }

        if (!tableInfo.duration) {
          await queryInterface.addColumn('bet_result_trx_wix', 'duration', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 60,
            comment: 'Duration in seconds (60, 180, 300, 600)'
          });
          console.log('Successfully added duration column');
        }

        // Add unique constraint using raw SQL since getConstraint is not available
        try {
          await queryInterface.sequelize.query(
            'ALTER TABLE bet_result_trx_wix ADD CONSTRAINT bet_result_trx_wix_period_duration_unique UNIQUE (period, duration)'
          );
          console.log('Successfully added unique constraint');
        } catch (constraintError) {
          // If constraint already exists, ignore the error
          if (!constraintError.message.includes('Duplicate key name')) {
            throw constraintError;
          }
          console.log('Unique constraint already exists');
        }
      } else {
        // Create the table with correct name
        await queryInterface.createTable('bet_result_trx_wix', {
          result_id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true
          },
          period: {
            type: Sequelize.STRING,
            allowNull: false
          },
          result: {
            type: Sequelize.JSON,
            allowNull: false
          },
          verification_hash: {
            type: Sequelize.STRING,
            allowNull: false
          },
          verification_link: {
            type: Sequelize.STRING,
            allowNull: false
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
          },
          timeline: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'default'
          },
          duration: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 60,
            comment: 'Duration in seconds (60, 180, 300, 600)'
          }
        });

        // Add composite unique constraint using raw SQL
        await queryInterface.sequelize.query(
          'ALTER TABLE bet_result_trx_wix ADD CONSTRAINT bet_result_trx_wix_period_duration_unique UNIQUE (period, duration)'
        );

        console.log('Successfully created bet_result_trx_wix table');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove the columns if they exist
      const tableInfo = await queryInterface.describeTable('bet_result_trx_wix');
      
      if (tableInfo.timeline) {
        await queryInterface.removeColumn('bet_result_trx_wix', 'timeline');
      }
      
      if (tableInfo.duration) {
        await queryInterface.removeColumn('bet_result_trx_wix', 'duration');
      }

      // Remove the constraint using raw SQL
      try {
        await queryInterface.sequelize.query(
          'ALTER TABLE bet_result_trx_wix DROP CONSTRAINT bet_result_trx_wix_period_duration_unique'
        );
      } catch (error) {
        // If constraint doesn't exist, ignore the error
        if (!error.message.includes('Unknown constraint')) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }
}; 