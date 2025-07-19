'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bet_result_trx_wix', 'block_number', {
      type: Sequelize.BIGINT,
      allowNull: true,
      comment: 'TRON block number extracted from hash'
    });

    await queryInterface.addColumn('bet_result_trx_wix', 'result_time', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
      comment: 'Result generation time in IST'
    });

    console.log('✅ Added block_number and result_time columns to bet_result_trx_wix table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bet_result_trx_wix', 'block_number');
    await queryInterface.removeColumn('bet_result_trx_wix', 'result_time');
    
    console.log('✅ Removed block_number and result_time columns from bet_result_trx_wix table');
  }
}; 