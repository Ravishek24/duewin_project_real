'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('gift_codes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: Sequelize.STRING, unique: true, allowNull: false },
      total_amount: { type: Sequelize.DECIMAL(15,2), allowNull: false },
      max_claims: { type: Sequelize.INTEGER, allowNull: false },
      claimed_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      amount_per_user: { type: Sequelize.DECIMAL(15,2), allowNull: false },
      created_by: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.createTable('gift_code_claims', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      gift_code_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'gift_codes', key: 'id' } },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      claimed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('gift_code_claims');
    await queryInterface.dropTable('gift_codes');
  }
}; 