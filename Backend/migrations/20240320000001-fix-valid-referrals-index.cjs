'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // First, drop the duplicate index if it exists
    try {
      await queryInterface.removeIndex('valid_referrals', 'valid_referrals_referrer_id_referred_id');
    } catch (error) {
      console.log('Index might not exist, continuing...');
    }

    // Then create the index with a unique name
    await queryInterface.addIndex('valid_referrals', ['referrer_id', 'referred_id'], {
      name: 'valid_referrals_unique_pair',
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the new index
    await queryInterface.removeIndex('valid_referrals', 'valid_referrals_unique_pair');
    
    // Recreate the original index
    await queryInterface.addIndex('valid_referrals', ['referrer_id', 'referred_id'], {
      name: 'valid_referrals_referrer_id_referred_id',
      unique: true
    });
  }
}; 