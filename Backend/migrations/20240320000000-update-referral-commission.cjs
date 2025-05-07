'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add type column if it doesn't exist
    const tableInfo = await queryInterface.describeTable('referral_commissions');
    if (!tableInfo.type) {
      await queryInterface.addColumn('referral_commissions', 'type', {
        type: Sequelize.ENUM('bet', 'deposit', 'direct_bonus', 'earned', 'generated'),
        allowNull: false,
        defaultValue: 'bet'
      });
    }

    // Update existing records to have the correct type
    await queryInterface.sequelize.query(`
      UPDATE referral_commissions
      SET type = 'earned'
      WHERE user_id IS NOT NULL;
    `);

    // Add index on type column if it doesn't exist
    const indexes = await queryInterface.showIndex('referral_commissions');
    const typeIndexExists = indexes.some(index => 
      index.name === 'referral_commissions_type_idx'
    );

    if (!typeIndexExists) {
      await queryInterface.addIndex('referral_commissions', ['type'], {
        name: 'referral_commissions_type_idx'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('referral_commissions', 'referral_commissions_type_idx');
    
    // Remove type column
    await queryInterface.removeColumn('referral_commissions', 'type');
  }
}; 