'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'is_blocked', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add blocked_at timestamp
    await queryInterface.addColumn('users', 'blocked_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add blocked_by reference to admin who blocked the user
    await queryInterface.addColumn('users', 'blocked_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id'
      }
    });

    // Add block_reason
    await queryInterface.addColumn('users', 'block_reason', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'is_blocked');
    await queryInterface.removeColumn('users', 'blocked_at');
    await queryInterface.removeColumn('users', 'blocked_by');
    await queryInterface.removeColumn('users', 'block_reason');
  }
}; 