'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('withdrawal_admin', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      withdrawal_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'wallet_withdrawals',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      admin_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'user_id'
        },
        comment: 'ID of admin who processed the approval/rejection'
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Admin notes or reason for rejection'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now')
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the admin processed the withdrawal'
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('withdrawal_admin', ['withdrawal_id']);
    await queryInterface.addIndex('withdrawal_admin', ['status']);
    await queryInterface.addIndex('withdrawal_admin', ['admin_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('withdrawal_admin');
  }
}; 