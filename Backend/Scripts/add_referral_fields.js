// Backend/scripts/add_referral_fields.js
const { sequelize } = require('../config/db');

const addReferralFields = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Execute the ALTER TABLE query
    await sequelize.query(`
      ALTER TABLE users 
        ADD COLUMN eligible_invitation_tier INT DEFAULT NULL,
        ADD COLUMN eligible_invitation_amount DECIMAL(15,2) DEFAULT NULL,
        ADD COLUMN valid_referral_count INT DEFAULT 0;
    `);
    
    console.log('✅ Added new referral fields to users table');
  } catch (error) {
    // Handle error if columns already exist
    if (error.message.includes('Duplicate column name')) {
      console.log('⚠️ Some columns already exist, skipping...');
    } else {
      console.error('❌ Error adding referral fields:', error);
    }
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

addReferralFields();

module.exports = {
  addReferralFields
};