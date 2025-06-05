const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/db');

async function createTables() {
  try {
    console.log('📦 Creating SPRIBE tables...');
    
    // Read SQL file
    const sqlFile = path.join(__dirname, '../sql/create_spribe_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute SQL
    await sequelize.query(sql);
    
    console.log('✅ SPRIBE tables created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating SPRIBE tables:', error);
    process.exit(1);
  }
}

createTables(); 