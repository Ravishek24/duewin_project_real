'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bank_accounts', 'ifsc_code', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'N/A' // Temporary default value for existing records
    });

    await queryInterface.addColumn('bank_accounts', 'is_primary', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bank_accounts', 'ifsc_code');
    await queryInterface.removeColumn('bank_accounts', 'is_primary');
  }
}; 