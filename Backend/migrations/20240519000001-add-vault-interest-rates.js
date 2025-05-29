'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Add vault_interest_rate column
      await queryInterface.addColumn('vip_levels', 'vault_interest_rate', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Vault interest rate percentage for this VIP level'
      });

      // Update VIP levels with the interest rates
      const vipLevels = [
        { level: 0, vault_interest_rate: 0.00 },
        { level: 1, vault_interest_rate: 0.10 },
        { level: 2, vault_interest_rate: 0.10 },
        { level: 3, vault_interest_rate: 0.15 },
        { level: 4, vault_interest_rate: 0.20 },
        { level: 5, vault_interest_rate: 0.25 },
        { level: 6, vault_interest_rate: 0.30 },
        { level: 7, vault_interest_rate: 0.35 },
        { level: 8, vault_interest_rate: 0.40 },
        { level: 9, vault_interest_rate: 0.45 },
        { level: 10, vault_interest_rate: 0.50 }
      ];

      // Update each VIP level
      for (const level of vipLevels) {
        await queryInterface.bulkUpdate('vip_levels', {
          vault_interest_rate: level.vault_interest_rate,
          updated_at: new Date()
        }, {
          level: level.level
        });
      }

      console.log('VIP levels updated with vault interest rates successfully');
    } catch (error) {
      console.error('Error updating VIP levels:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove the vault_interest_rate column
      await queryInterface.removeColumn('vip_levels', 'vault_interest_rate');
    } catch (error) {
      console.error('Error removing vault_interest_rate column:', error);
      throw error;
    }
  }
}; 