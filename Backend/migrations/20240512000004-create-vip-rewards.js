'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // First check if users table exists and has the correct structure
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('users')) {
      throw new Error('Users table does not exist');
    }

    // Get users table structure
    const usersTableInfo = await queryInterface.describeTable('users');
    if (!usersTableInfo.user_id) {
      throw new Error('Users table does not have a user_id column');
    }

    // Create vip_rewards table
    await queryInterface.createTable('vip_rewards', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      level: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      reward_type: {
        type: Sequelize.ENUM('level_up', 'monthly'),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      claimed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('vip_rewards', ['user_id', 'level', 'reward_type']);
    await queryInterface.addIndex('vip_rewards', ['user_id', 'reward_type', 'claimed_at']);

    // Add foreign key constraint after table creation
    try {
      await queryInterface.addConstraint('vip_rewards', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'vip_rewards_user_id_fk',
        references: {
          table: 'users',
          field: 'user_id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    } catch (error) {
      console.error('Warning: Could not add foreign key constraint:', error.message);
      // Continue without foreign key constraint
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vip_rewards');
  }
}; 