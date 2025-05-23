'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rebate_levels', 'min_team_members', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn('rebate_levels', 'min_team_betting', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn('rebate_levels', 'min_team_deposit', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('rebate_levels', 'min_team_members');
    await queryInterface.removeColumn('rebate_levels', 'min_team_betting');
    await queryInterface.removeColumn('rebate_levels', 'min_team_deposit');
  }
}; 