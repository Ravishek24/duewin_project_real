'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('🔄 Adding total_bet column to referral_commissions table...');
      
      // Add total_bet column
      await queryInterface.addColumn('referral_commissions', 'total_bet', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Total bet amount by referred user on the commission date'
      });

      console.log('✅ Added total_bet column');

      // Add composite index for efficient queries
      console.log('🔄 Adding composite index for performance...');
      await queryInterface.addIndex('referral_commissions', ['user_id', 'type', 'created_at'], {
        name: 'idx_referral_commissions_user_type_date',
        comment: 'Composite index for efficient user commission queries with date filtering'
      });

      // Add index for total_bet queries
      await queryInterface.addIndex('referral_commissions', ['total_bet'], {
        name: 'idx_referral_commissions_total_bet',
        comment: 'Index for total_bet field queries'
      });

      console.log('✅ Added performance indexes');

    } catch (error) {
      console.error('❌ Error in migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('🔄 Rolling back total_bet column addition...');
      
      // Remove indexes
      await queryInterface.removeIndex('referral_commissions', 'idx_referral_commissions_user_type_date');
      await queryInterface.removeIndex('referral_commissions', 'idx_referral_commissions_total_bet');
      
      // Remove total_bet column
      await queryInterface.removeColumn('referral_commissions', 'total_bet');
      
      console.log('✅ Rollback completed');

    } catch (error) {
      console.error('❌ Error in rollback:', error);
      throw error;
    }
  }
};
