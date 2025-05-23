#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Setting up test environment..."

# 1. Create test database
echo "Creating test database..."
mysql -u root -p <<EOF
CREATE DATABASE IF NOT EXISTS diuwin_test;
USE diuwin_test;
EOF

# 2. Run migrations for test database
echo "Running migrations..."
NODE_ENV=test npx sequelize-cli db:migrate

# 3. Create test user
echo "Creating test user..."
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123",
    "email": "test@example.com",
    "phone_no": "1234567890"
  }'

# 4. Get test token
echo "Getting test token..."
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123"
  }' | jq -r '.token')

# 5. Save token to environment
echo "export TEST_TOKEN=$TOKEN" > .env.test

# 6. Install required packages
echo "Installing required packages..."
npm install -g artillery
npm install artillery-plugin-metrics-by-endpoint

# 7. Create test data
echo "Creating test data..."
node <<EOF
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
EOF

echo -e "${GREEN}Test environment setup completed!${NC}"
echo "You can now run the load tests using: ./run-load-test.sh" 