'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Add new columns
      await queryInterface.addColumn('vip_levels', 'bonus_amount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      });

      await queryInterface.addColumn('vip_levels', 'monthly_reward', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      });

      await queryInterface.addColumn('vip_levels', 'rebate_rate', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      });

      // Update VIP levels with the correct values
      const vipLevels = [
        {
          level: 1,
          required_exp: 3000,
          bonus_amount: 60.00,
          monthly_reward: 30.00,
          rebate_rate: 0.05
        },
        {
          level: 2,
          required_exp: 30000,
          bonus_amount: 180.00,
          monthly_reward: 90.00,
          rebate_rate: 0.05
        },
        {
          level: 3,
          required_exp: 400000,
          bonus_amount: 690.00,
          monthly_reward: 290.00,
          rebate_rate: 0.10
        },
        {
          level: 4,
          required_exp: 4000000,
          bonus_amount: 1890.00,
          monthly_reward: 890.00,
          rebate_rate: 0.10
        },
        {
          level: 5,
          required_exp: 20000000,
          bonus_amount: 6900.00,
          monthly_reward: 1890.00,
          rebate_rate: 0.10
        },
        {
          level: 6,
          required_exp: 80000000,
          bonus_amount: 16900.00,
          monthly_reward: 6900.00,
          rebate_rate: 0.15
        },
        {
          level: 7,
          required_exp: 300000000,
          bonus_amount: 69000.00,
          monthly_reward: 16900.00,
          rebate_rate: 0.15
        },
        {
          level: 8,
          required_exp: 1000000000,
          bonus_amount: 169000.00,
          monthly_reward: 69000.00,
          rebate_rate: 0.15
        },
        {
          level: 9,
          required_exp: 50000000000,
          bonus_amount: 690000.00,
          monthly_reward: 169000.00,
          rebate_rate: 0.30
        },
        {
          level: 10,
          required_exp: 999999999,
          bonus_amount: 1690000.00,
          monthly_reward: 690000.00,
          rebate_rate: 0.30
        }
      ];

      // Update each VIP level
      for (const level of vipLevels) {
        await queryInterface.bulkUpdate('vip_levels', {
          required_exp: level.required_exp,
          bonus_amount: level.bonus_amount,
          monthly_reward: level.monthly_reward,
          rebate_rate: level.rebate_rate,
          updated_at: new Date()
        }, {
          level: level.level
        });
      }

      console.log('VIP levels updated with benefits successfully');
    } catch (error) {
      console.error('Error updating VIP levels:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove the added columns
      await queryInterface.removeColumn('vip_levels', 'bonus_amount');
      await queryInterface.removeColumn('vip_levels', 'monthly_reward');
      await queryInterface.removeColumn('vip_levels', 'rebate_rate');
      
      console.log('VIP level benefits columns removed successfully');
    } catch (error) {
      console.error('Error removing VIP level benefits:', error);
      throw error;
    }
  }
}; 