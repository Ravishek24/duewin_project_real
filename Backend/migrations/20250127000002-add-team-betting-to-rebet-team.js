'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rebet_team_table', 'current_team_betting', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Total daily betting amount by team members'
    });

    // Add index for performance
    await queryInterface.addIndex('rebet_team_table', ['current_team_betting']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('rebet_team_table', 'current_team_betting');
  }
}; 