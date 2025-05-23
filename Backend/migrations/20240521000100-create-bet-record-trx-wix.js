'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bet_record_trx_wix', {
      bet_id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      period: {
        type: Sequelize.STRING,
        allowNull: false
      },
      bet_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      bet_amount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false
      },
      odds: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'won', 'lost'),
        defaultValue: 'pending'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bet_record_trx_wix');
  }
}; 