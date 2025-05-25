'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // First, drop the existing index since we'll need to modify the column
    await queryInterface.removeIndex('bet_result_trx_wix', 'bet_result_trx_wix_period_duration_unique');

    // Modify the result column to use JSON type
    await queryInterface.changeColumn('bet_result_trx_wix', 'result', {
      type: Sequelize.JSON,
      allowNull: false
    });

    // Recreate the index
    await queryInterface.addIndex('bet_result_trx_wix', ['period', 'duration'], {
      unique: true,
      name: 'bet_result_trx_wix_period_duration_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    // First, drop the index
    await queryInterface.removeIndex('bet_result_trx_wix', 'bet_result_trx_wix_period_duration_unique');

    // Revert the result column back to JSONB
    await queryInterface.changeColumn('bet_result_trx_wix', 'result', {
      type: Sequelize.JSONB,
      allowNull: false
    });

    // Recreate the index
    await queryInterface.addIndex('bet_result_trx_wix', ['period', 'duration'], {
      unique: true,
      name: 'bet_result_trx_wix_period_duration_unique'
    });
  }
}; 