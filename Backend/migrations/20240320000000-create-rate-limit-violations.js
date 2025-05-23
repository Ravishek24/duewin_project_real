'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('rate_limit_violations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'user_id'
        }
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: false
      },
      endpoint: {
        type: Sequelize.STRING,
        allowNull: false
      },
      violation_type: {
        type: Sequelize.ENUM('IP', 'USER', 'BOTH'),
        allowNull: false
      },
      request_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      time_window: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      limit: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      is_blocked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      blocked_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      unblocked_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      unblocked_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'user_id'
        }
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      last_violation_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
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
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('rate_limit_violations');
  }
}; 