'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Add new columns to users table
      await queryInterface.addColumn('users', 'actual_deposit_amount', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total amount actually deposited by user (excluding bonuses)'
      });

      await queryInterface.addColumn('users', 'bonus_amount', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total bonus amount received by user'
      });

      await queryInterface.addColumn('users', 'total_bet_amount', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total amount bet by user'
      });

      // Update existing users' actual_deposit_amount based on their recharge history
      await queryInterface.sequelize.query(`
        UPDATE users u
        SET actual_deposit_amount = (
          SELECT COALESCE(SUM(amount), 0)
          FROM wallet_recharges wr
          WHERE wr.user_id = u.user_id
          AND wr.status = 'completed'
        )
      `);

    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove the columns
      await queryInterface.removeColumn('users', 'actual_deposit_amount');
      await queryInterface.removeColumn('users', 'bonus_amount');
      await queryInterface.removeColumn('users', 'total_bet_amount');
    } catch (error) {
      console.error('Migration rollback error:', error);
      throw error;
    }
  }
}; 