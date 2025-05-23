'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('otp_requests', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      phone_no: {
        type: Sequelize.STRING,
        allowNull: false
      },
      otp_session_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      request_type: {
        type: Sequelize.ENUM('forgot_password', 'phone_update', 'bank_account', 'admin_login'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'verified', 'expired'),
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
    await queryInterface.dropTable('otp_requests');
  }
}; 