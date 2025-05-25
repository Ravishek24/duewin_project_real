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
        allowNull: false
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
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      timeline: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'default'
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 60,
        comment: 'Duration in seconds (60, 180, 300, 600)'
      }
    });

    await queryInterface.addIndex('bet_result_trx_wix', ['period', 'duration'], {
      unique: true,
      name: 'bet_result_trx_wix_period_duration_unique'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bet_result_trx_wix');
  }
}; 