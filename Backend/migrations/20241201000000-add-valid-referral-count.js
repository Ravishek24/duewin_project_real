'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if column exists first
    const tableInfo = await queryInterface.describeTable('users');
    
    if (!tableInfo.valid_referral_count) {
      await queryInterface.addColumn('users', 'valid_referral_count', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of valid referrals (users who have recharged at least ₹300)'
      });
      
      console.log('✅ Added valid_referral_count column to users table');
    } else {
      console.log('ℹ️ valid_referral_count column already exists');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Check if column exists before removing
    const tableInfo = await queryInterface.describeTable('users');
    if (tableInfo.valid_referral_count) {
      await queryInterface.removeColumn('users', 'valid_referral_count');
      console.log('✅ Removed valid_referral_count column from users table');
    }
  }
}; 