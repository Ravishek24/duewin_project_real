'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('referral_commissions', 'referred_user_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      },
      after: 'user_id'
    });

    // Add type and rebate_type columns if they don't exist
    await queryInterface.addColumn('referral_commissions', 'type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'bet',
      after: 'amount'
    });

    await queryInterface.addColumn('referral_commissions', 'rebate_type', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'type'
    });

    await queryInterface.addColumn('referral_commissions', 'distribution_batch_id', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'rebate_type'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('referral_commissions', 'referred_user_id');
    await queryInterface.removeColumn('referral_commissions', 'type');
    await queryInterface.removeColumn('referral_commissions', 'rebate_type');
    await queryInterface.removeColumn('referral_commissions', 'distribution_batch_id');
  }
}; 