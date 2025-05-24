'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Helper function to check if table exists
      const tableExists = async (tableName) => {
        try {
          await queryInterface.describeTable(tableName);
          return true;
        } catch (error) {
          return false;
        }
      };

      // Helper function to check if column exists
      const columnExists = async (tableName, columnName) => {
        try {
          const tableInfo = await queryInterface.describeTable(tableName);
          return !!tableInfo[columnName];
        } catch (error) {
          return false;
        }
      };

      // Helper function to check if constraint exists
      const constraintExists = async (tableName, constraintName) => {
        try {
          const constraints = await queryInterface.showConstraint(tableName);
          return constraints.some(c => c.constraintName === constraintName);
        } catch (error) {
          return false;
        }
      };

      // Add duration column to all result tables if not exists
      const tables = [
        { name: 'bet_result_wingos', periodColumn: 'bet_number', duration: 30 },
        { name: 'bet_result_k3s', periodColumn: 'bet_number', duration: 60 },
        { name: 'bet_result_5ds', periodColumn: 'bet_number', duration: 60 },
        { name: 'bet_result_trx_wix', periodColumn: 'period', duration: 60 }
      ];

      for (const table of tables) {
        // First check if table exists
        if (!(await tableExists(table.name))) {
          console.log(`Table ${table.name} does not exist, skipping...`);
          continue;
        }

        // Check if period column exists
        if (!(await columnExists(table.name, table.periodColumn))) {
          console.log(`Column '${table.periodColumn}' does not exist in table ${table.name}, skipping...`);
          continue;
        }

        // Add duration column if it doesn't exist
        if (!(await columnExists(table.name, 'duration'))) {
          console.log(`Adding duration column to ${table.name}...`);
          await queryInterface.addColumn(table.name, 'duration', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: table.duration,
            comment: `Duration in seconds (${table.name === 'bet_result_wingos' ? '30, 60, 180, 300' : '60, 180, 300, 600'})`
          });
        }

        // Remove unique constraint from period column if exists
        const periodConstraint = `${table.name}_${table.periodColumn}_key`;
        if (await constraintExists(table.name, periodConstraint)) {
          console.log(`Removing period constraint from ${table.name}...`);
          await queryInterface.removeConstraint(table.name, periodConstraint);
        }

        // Add composite unique constraint for period + duration if not exists
        const compositeConstraint = `${table.name}_${table.periodColumn}_duration_unique`;
        if (!(await constraintExists(table.name, compositeConstraint))) {
          console.log(`Adding composite constraint to ${table.name}...`);
          await queryInterface.addConstraint(table.name, {
            fields: [table.periodColumn, 'duration'],
            type: 'unique',
            name: compositeConstraint
          });
        }
      }

      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Helper function to check if table exists
      const tableExists = async (tableName) => {
        try {
          await queryInterface.describeTable(tableName);
          return true;
        } catch (error) {
          return false;
        }
      };

      // Helper function to check if constraint exists
      const constraintExists = async (tableName, constraintName) => {
        try {
          const constraints = await queryInterface.showConstraint(tableName);
          return constraints.some(c => c.constraintName === constraintName);
        } catch (error) {
          return false;
        }
      };

      const tables = [
        { name: 'bet_result_wingos', periodColumn: 'bet_number' },
        { name: 'bet_result_k3s', periodColumn: 'bet_number' },
        { name: 'bet_result_5ds', periodColumn: 'bet_number' },
        { name: 'bet_result_trx_wix', periodColumn: 'period' }
      ];

      for (const table of tables) {
        // First check if table exists
        if (!(await tableExists(table.name))) {
          console.log(`Table ${table.name} does not exist, skipping...`);
          continue;
        }

        // Remove composite unique constraints if they exist
        const compositeConstraint = `${table.name}_${table.periodColumn}_duration_unique`;
        if (await constraintExists(table.name, compositeConstraint)) {
          console.log(`Removing composite constraint from ${table.name}...`);
          await queryInterface.removeConstraint(table.name, compositeConstraint);
        }

        // Add back unique constraint on period if it doesn't exist
        const periodConstraint = `${table.name}_${table.periodColumn}_key`;
        if (!(await constraintExists(table.name, periodConstraint))) {
          console.log(`Adding period constraint to ${table.name}...`);
          await queryInterface.addConstraint(table.name, {
            fields: [table.periodColumn],
            type: 'unique',
            name: periodConstraint
          });
        }

        // Remove duration column if it exists
        const tableInfo = await queryInterface.describeTable(table.name);
        if (tableInfo.duration) {
          console.log(`Removing duration column from ${table.name}...`);
          await queryInterface.removeColumn(table.name, 'duration');
        }
      }

      console.log('Rollback completed successfully');
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }
}; 