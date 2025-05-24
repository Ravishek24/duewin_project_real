'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Helper function to check if a constraint exists
      const constraintExists = async (tableName, constraintName) => {
        const constraints = await queryInterface.showConstraint(tableName);
        return constraints.some(constraint => constraint.constraintName === constraintName);
      };

      // Helper function to check if a column exists
      const columnExists = async (tableName, columnName) => {
        const tableInfo = await queryInterface.describeTable(tableName);
        return tableInfo[columnName] !== undefined;
      };

      // Tables to update
      const tables = [
        { name: 'bet_result_wingos', constraint: 'bet_result_wingos_bet_number_unique', column: 'bet_number' },
        { name: 'bet_result_5ds', constraint: 'bet_result_5ds_bet_number_unique', column: 'bet_number' },
        { name: 'bet_result_k3s', constraint: 'bet_result_k3s_bet_number_unique', column: 'bet_number' },
        { name: 'bet_result_trx_wix', constraint: 'bet_result_trx_wix_period_unique', column: 'period' }
      ];

      // Process each table
      for (const table of tables) {
        console.log(`Processing table: ${table.name}`);

        // First, drop any existing unique constraints on the column
        console.log(`Dropping unique constraint from ${table.column} in ${table.name}`);
        await queryInterface.sequelize.query(
          `ALTER TABLE ${table.name} DROP INDEX ${table.constraint};`
        ).catch(err => {
          if (err.original && err.original.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
            console.log(`No unique constraint found on ${table.column} in ${table.name}`);
          } else {
            throw err;
          }
        });

        // Check if both period/bet_number and duration columns exist
        const hasPeriodColumn = await columnExists(table.name, table.column);
        const hasDuration = await columnExists(table.name, 'duration');

        if (hasPeriodColumn && hasDuration) {
          // Check if composite constraint already exists
          const compositeConstraintName = `${table.name}_${table.column}_duration_unique`;
          const hasCompositeConstraint = await constraintExists(table.name, compositeConstraintName);

          if (!hasCompositeConstraint) {
            // Add composite unique constraint only if it doesn't exist
            console.log(`Adding composite unique constraint to ${table.name}`);
            await queryInterface.addConstraint(table.name, {
              fields: [table.column, 'duration'],
              type: 'unique',
              name: compositeConstraintName
            });
          } else {
            console.log(`Composite constraint already exists for ${table.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Tables to revert
      const tables = [
        { name: 'bet_result_wingos', constraint: 'bet_result_wingos_bet_number_duration_unique', column: 'bet_number' },
        { name: 'bet_result_5ds', constraint: 'bet_result_5ds_bet_number_duration_unique', column: 'bet_number' },
        { name: 'bet_result_k3s', constraint: 'bet_result_k3s_bet_number_duration_unique', column: 'bet_number' },
        { name: 'bet_result_trx_wix', constraint: 'bet_result_trx_wix_period_duration_unique', column: 'period' }
      ];

      // Process each table
      for (const table of tables) {
        console.log(`Processing table: ${table.name}`);

        // Remove composite unique constraint
        const hasConstraint = await queryInterface.showConstraint(table.name)
          .then(constraints => constraints.some(c => c.constraintName === table.constraint));

        if (hasConstraint) {
          console.log(`Removing composite unique constraint from ${table.name}`);
          await queryInterface.removeConstraint(table.name, table.constraint);
        }

        // Add back single column unique constraint
        console.log(`Adding back unique constraint to ${table.name}`);
        await queryInterface.addConstraint(table.name, {
          fields: [table.column],
          type: 'unique',
          name: `${table.name}_${table.column}_unique`
        });
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}; 