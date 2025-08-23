'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // First, let's check if the transactions table exists and what types it currently has
      const tableInfo = await queryInterface.describeTable('transactions');
      
      if (!tableInfo.type) {
        console.log('Transactions table does not exist or has no type column');
        return;
      }

      // Get current ENUM values
      const currentTypes = tableInfo.type.values || [];
      console.log('Current transaction types:', currentTypes);

      // Define all the transaction types we need
      const requiredTypes = [
        'deposit',
        'withdrawal', 
        'admin_credit',
        'admin_debit',
        'game_win',
        'game_loss',
        'game_move_in',
        'game_move_out',
        'gift_code',
        'referral_bonus',
        'registration_bonus',
        'first_deposit_bonus',  // 🎯 This is the key one we need
        'deposit_rejected',
        'direct_bonus',
        'attendance_bonus',
        'deposit_failed',
        'withdrawal_failed',
        'withdrawal_rejected',
        'self_rebate',
        'referral_commission',
        'activity_reward',
        'rebate',
        'vip_reward',
        'transfer_in',
        'transfer_out',
        'refund'
      ];

      // Find missing types
      const missingTypes = requiredTypes.filter(type => !currentTypes.includes(type));
      
      if (missingTypes.length === 0) {
        console.log('All required transaction types are already present');
        return;
      }

      console.log('Missing transaction types:', missingTypes);

      // For MySQL, we need to recreate the ENUM with all values
      // This is because MySQL doesn't support adding values to ENUM directly
      
      // Get the current table structure
      const tableName = 'transactions';
      const columnName = 'type';
      
      // Create new ENUM with all required types
      const newEnumValues = [...currentTypes, ...missingTypes];
      
      // Update the column definition
      await queryInterface.changeColumn(tableName, columnName, {
        type: Sequelize.ENUM(...newEnumValues),
        allowNull: false,
        comment: 'Type of transaction'
      });

      console.log(`✅ Successfully added missing transaction types: ${missingTypes.join(', ')}`);
      console.log(`✅ Total transaction types now: ${newEnumValues.length}`);

    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Revert to original ENUM values
      const originalTypes = [
        'deposit',
        'withdrawal',
        'admin_credit',
        'admin_debit',
        'game_win',
        'game_loss',
        'gift_code',
        'referral_bonus',
        'rebate',
        'vip_reward',
        'transfer_in',
        'transfer_out',
        'refund',
        'game_move_in',
        'game_move_out'
      ];

      await queryInterface.changeColumn('transactions', 'type', {
        type: Sequelize.ENUM(...originalTypes),
        allowNull: false
      });

      console.log('✅ Reverted transaction types to original values');
      
    } catch (error) {
      console.error('Rollback error:', error);
      throw error;
    }
  }
};
