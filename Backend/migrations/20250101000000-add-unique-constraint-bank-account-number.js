'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // First, check if there are any duplicate account numbers
      const duplicates = await queryInterface.sequelize.query(`
        SELECT account_number, COUNT(*) as count
        FROM bank_accounts 
        WHERE account_number IS NOT NULL 
        GROUP BY account_number 
        HAVING COUNT(*) > 1
      `);

      if (duplicates[0].length > 0) {
        console.log('⚠️ Found duplicate bank account numbers. Please resolve these before adding unique constraint:');
        duplicates[0].forEach(dup => {
          console.log(`   Account number: ${dup.account_number}, Count: ${dup.count}`);
        });
        throw new Error('Cannot add unique constraint: duplicate account numbers found. Please resolve duplicates first.');
      }

      // Add unique constraint on account_number
      await queryInterface.addConstraint('bank_accounts', {
        fields: ['account_number'],
        type: 'unique',
        name: 'uk_bank_accounts_account_number'
      });

      console.log('✅ Successfully added unique constraint on bank_accounts.account_number');
    } catch (error) {
      console.error('❌ Error adding unique constraint:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove unique constraint
      await queryInterface.removeConstraint('bank_accounts', 'uk_bank_accounts_account_number');
      console.log('✅ Successfully removed unique constraint from bank_accounts.account_number');
    } catch (error) {
      console.error('❌ Error removing unique constraint:', error.message);
      throw error;
    }
  }
};
