'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add lottery rebate columns
    await queryInterface.addColumn('rebate_levels', 'lottery_l1_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'lottery_l2_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'lottery_l3_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'lottery_l4_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'lottery_l5_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'lottery_l6_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });

    // Add casino rebate columns
    await queryInterface.addColumn('rebate_levels', 'casino_l1_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'casino_l2_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'casino_l3_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'casino_l4_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'casino_l5_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
    await queryInterface.addColumn('rebate_levels', 'casino_l6_rebate', {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove lottery rebate columns
    await queryInterface.removeColumn('rebate_levels', 'lottery_l1_rebate');
    await queryInterface.removeColumn('rebate_levels', 'lottery_l2_rebate');
    await queryInterface.removeColumn('rebate_levels', 'lottery_l3_rebate');
    await queryInterface.removeColumn('rebate_levels', 'lottery_l4_rebate');
    await queryInterface.removeColumn('rebate_levels', 'lottery_l5_rebate');
    await queryInterface.removeColumn('rebate_levels', 'lottery_l6_rebate');

    // Remove casino rebate columns
    await queryInterface.removeColumn('rebate_levels', 'casino_l1_rebate');
    await queryInterface.removeColumn('rebate_levels', 'casino_l2_rebate');
    await queryInterface.removeColumn('rebate_levels', 'casino_l3_rebate');
    await queryInterface.removeColumn('rebate_levels', 'casino_l4_rebate');
    await queryInterface.removeColumn('rebate_levels', 'casino_l5_rebate');
    await queryInterface.removeColumn('rebate_levels', 'casino_l6_rebate');
  }
}; 