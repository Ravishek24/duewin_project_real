const { sequelize } = require('../models');
const { User, VipLevel, GameSession } = require('../models');

async function createTestData() {
  try {
    // Create VIP levels
    await VipLevel.bulkCreate([
      { level: 1, name: 'VIP 1', exp_required: 3000, bonus_amount: 60, monthly_reward: 30, rebate_rate: 0.05 },
      { level: 2, name: 'VIP 2', exp_required: 30000, bonus_amount: 180, monthly_reward: 90, rebate_rate: 0.05 }
    ]);

    // Create test game sessions
    await GameSession.bulkCreate([
      { user_id: 1, game_type: 'k3', session_id: 'test-session-1', balance: 1000, status: 'active' },
      { user_id: 1, game_type: '5d', session_id: 'test-session-2', balance: 1000, status: 'active' }
    ]);

    console.log('Test data created successfully');
  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

createTestData();
