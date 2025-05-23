require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcrypt');
const { sequelize } = require('../config/db');

async function createTestUser() {
  try {
    console.log('Starting test user creation...');
    console.log('Database config:', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      hasPassword: !!process.env.DB_PASS
    });
    
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');
    
    // Generate a random referral code
    const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('Test@123', 10);
    
    // Create user directly with SQL query to avoid model dependencies
    const [result] = await sequelize.query(`
      INSERT INTO users (
        user_name, 
        email, 
        phone_no, 
        password, 
        is_phone_verified,
        referring_code,
        referral_code,
        wallet_balance,
        registration_ip,
        current_ip,
        created_at,
        updated_at
      ) VALUES (
        'testuser',
        'test@example.com',
        '9876543210',
        '${hashedPassword}',
        true,
        '${referralCode}',
        'WELCOME',
        0.00,
        '127.0.0.1',
        '127.0.0.1',
        NOW(),
        NOW()
      )
    `);
    
    const userId = result;
    
    console.log('Test user created successfully!');
    console.log('User details:');
    console.log(`- User ID: ${userId}`);
    console.log(`- Username: testuser`);
    console.log(`- Email: test@example.com`);
    console.log(`- Phone: 9876543210`);
    console.log(`- Referral Code: ${referralCode}`);
    console.log(`- Login Password: Test@123`);
    
    console.log('\nYou can now log in with this user.');
    
    return true;
  } catch (error) {
    console.error('Error creating test user:', error);
    return false;
  } finally {
    try {
      // Close the database connection
      await sequelize.close();
    } catch (e) {
      console.error('Error closing database connection:', e);
    }
  }
}

// Execute the function when script is run directly
if (require.main === module) {
  createTestUser()
    .then(result => {
      process.exit(result ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = { createTestUser };
} 