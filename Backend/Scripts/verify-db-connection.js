/**
 * Script to verify database connection and run a test query
 */
const { sequelize } = require('../config/db');

async function verifyConnection() {
  try {
    console.log('Attempting to connect to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');

    // Test query to check if tables exist
    console.log('\nChecking database tables:');
    
    const tables = [
      'users',
      'wallet_recharges',
      'wallet_withdrawals',
      'payment_gateways'
    ];
    
    for (const table of tables) {
      try {
        const [result] = await sequelize.query(`SHOW COLUMNS FROM ${table}`);
        console.log(`✅ Table ${table} exists with ${result.length} columns`);
      } catch (error) {
        console.error(`❌ Error checking table ${table}:`, error.message);
      }
    }

    // Try a simple select query
    console.log('\nTrying simple SELECT queries:');
    
    try {
      const [users] = await sequelize.query('SELECT COUNT(*) as count FROM users');
      console.log(`✅ Users table has ${users[0].count} records`);
    } catch (error) {
      console.error('❌ Error querying users table:', error.message);
    }
    
    try {
      const [gateways] = await sequelize.query('SELECT * FROM payment_gateways LIMIT 2');
      console.log(`✅ Found ${gateways.length} payment gateways:`);
      gateways.forEach(gateway => {
        console.log(`  - ${gateway.name} (${gateway.code})`);
      });
    } catch (error) {
      console.error('❌ Error querying payment_gateways table:', error.message);
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error);
  } finally {
    await sequelize.close();
    console.log('\nDatabase connection closed');
  }
}

verifyConnection();