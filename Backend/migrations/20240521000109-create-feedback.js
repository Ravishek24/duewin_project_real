'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('feedbacks', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        },
        comment: 'User who submitted the feedback'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Content of the feedback'
      },
      status: {
        type: Sequelize.ENUM('pending', 'read', 'responded'),
        defaultValue: 'pending',
        comment: 'Status of the feedback'
      },
      admin_response: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Admin response to the feedback'
      },
      responded_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'user_id'
        },
        comment: 'Admin who responded to the feedback'
      },
      responded_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the admin responded'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('feedbacks', ['user_id']);
    await queryInterface.addIndex('feedbacks', ['status']);
    await queryInterface.addIndex('feedbacks', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('feedbacks');
  }
}; 