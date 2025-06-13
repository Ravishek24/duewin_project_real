'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add is_default column
    await queryInterface.addColumn('usdt_accounts', 'is_default', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add remark column if it doesn't exist (it seems to exist in DB but not in model)
    try {
      await queryInterface.addColumn('usdt_accounts', 'remark', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (error) {
      // Column might already exist, which is fine
      console.log('Remark column might already exist');
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove is_default column
    await queryInterface.removeColumn('usdt_accounts', 'is_default');
    
    // Remove remark column
    await queryInterface.removeColumn('usdt_accounts', 'remark');
  }
}; 