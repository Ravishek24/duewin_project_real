'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if column exists first
      const tableInfo = await queryInterface.describeTable('users');
      
      if (!tableInfo.has_received_first_bonus) {
        // Add new column to users table if it doesn't exist
        await queryInterface.addColumn('users', 'has_received_first_bonus', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Whether user has received first recharge bonus'
        });
      }

      // Check if bonus_amount column exists in wallet_recharges
      const walletRechargesInfo = await queryInterface.describeTable('wallet_recharges');
      
      if (!walletRechargesInfo.bonus_amount) {
        // Add bonus_amount column to wallet_recharges if it doesn't exist
        await queryInterface.addColumn('wallet_recharges', 'bonus_amount', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.00,
          comment: 'Bonus amount given for this recharge'
        });
      }

      // Update existing users who have received bonus
      await queryInterface.sequelize.query(`
        UPDATE users u
        SET has_received_first_bonus = true
        WHERE EXISTS (
          SELECT 1
          FROM wallet_recharges wr
          WHERE wr.user_id = u.user_id
          AND wr.status = 'completed'
          AND wr.bonus_amount > 0
        )
      `);

    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove the columns if they exist
      const tableInfo = await queryInterface.describeTable('users');
      if (tableInfo.has_received_first_bonus) {
        await queryInterface.removeColumn('users', 'has_received_first_bonus');
      }

      const walletRechargesInfo = await queryInterface.describeTable('wallet_recharges');
      if (walletRechargesInfo.bonus_amount) {
        await queryInterface.removeColumn('wallet_recharges', 'bonus_amount');
      }
    } catch (error) {
      console.error('Migration rollback error:', error);
      throw error;
    }
  }
}; 