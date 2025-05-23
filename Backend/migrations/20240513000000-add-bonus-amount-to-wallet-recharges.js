'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if column exists first
    const tableInfo = await queryInterface.describeTable('wallet_recharges');
    
    if (!tableInfo.bonus_amount) {
      await queryInterface.addColumn('wallet_recharges', 'bonus_amount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Bonus amount given for this recharge'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Check if column exists before removing
    const tableInfo = await queryInterface.describeTable('wallet_recharges');
    if (tableInfo.bonus_amount) {
      await queryInterface.removeColumn('wallet_recharges', 'bonus_amount');
    }
  }
}; 