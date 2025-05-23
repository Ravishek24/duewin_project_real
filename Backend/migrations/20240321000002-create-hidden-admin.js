'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('system_configs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      encrypted_data: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      username_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true
      },
      email_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
        unique: true
      },
      phone_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
        unique: true
      },
      last_access: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('system_configs');
  }
}; 