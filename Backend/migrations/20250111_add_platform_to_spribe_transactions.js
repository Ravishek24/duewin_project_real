'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('spribe_transactions', 'platform', {
      type: Sequelize.ENUM('mobile', 'desktop'),
      allowNull: true,
      defaultValue: 'desktop',
      comment: 'Platform where transaction occurred'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('spribe_transactions', 'platform');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_spribe_transactions_platform;');
  }
}; 