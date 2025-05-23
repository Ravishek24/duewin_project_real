# PowerShell script for setting up test environment

Write-Host "Setting up test environment..." -ForegroundColor Green

# 1. Create test database
Write-Host "Creating test database..."
$dbQuery = @"
CREATE DATABASE IF NOT EXISTS diuwin_test;
USE diuwin_test;
"@

# You'll need to provide MySQL credentials
$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
& $mysqlPath -u root -p -e $dbQuery

# 2. Run migrations for test database
Write-Host "Running migrations..."
$env:NODE_ENV = "test"
npx sequelize-cli db:migrate

# 3. Create test user
Write-Host "Creating test user..."
$registerBody = @{
    username = "testuser"
    password = "testpass123"
    email = "test@example.com"
    phone_no = "1234567890"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "https://strike.atsproduct.in/api/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $registerBody
    Write-Host "Test user created successfully" -ForegroundColor Green
} catch {
    Write-Host "Error creating test user: $_" -ForegroundColor Red
}

# 4. Get test token
Write-Host "Getting test token..."
$loginBody = @{
    username = "testuser"
    password = "testpass123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "https://strike.atsproduct.in/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody
    
    # Save token to environment variable
    $env:TEST_TOKEN = $loginResponse.token
    Write-Host "Test token obtained successfully" -ForegroundColor Green
} catch {
    Write-Host "Error getting test token: $_" -ForegroundColor Red
}

# 5. Save token to file
$env:TEST_TOKEN | Out-File -FilePath ".env.test"

# 6. Install required packages
Write-Host "Installing required packages..."
npm install -g artillery
npm install artillery-plugin-metrics-by-endpoint

# 7. Create test data
Write-Host "Creating test data..."
$testDataScript = @"
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
"@

$testDataScript | Out-File -FilePath "create-test-data.js"
node create-test-data.js

Write-Host "Test environment setup completed!" -ForegroundColor Green
Write-Host "You can now run the load tests using: .\run-load-test.ps1" -ForegroundColor Green 