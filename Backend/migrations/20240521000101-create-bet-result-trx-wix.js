'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bet_result_trx_wix', {
      result_id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      period: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      result: {
        type: Sequelize.JSON,
        allowNull: false
      },
      verification_hash: {
        type: Sequelize.STRING,
        allowNull: false
      },
      verification_link: {
        type: Sequelize.STRING,
        allowNull: false
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
    await queryInterface.dropTable('bet_result_trx_wix');
  }
}; 