const { sequelize } = require('../config/db');
const { getModels } = require('../models');

async function populateWithdrawalAdminRecords() {
  try {
    console.log('🔄 Starting to populate withdrawal_admin records...');
    
    const models = await getModels();
    if (!models) {
      throw new Error('Models not initialized');
    }

    // Get all pending withdrawals that don't have admin records
    const pendingWithdrawals = await models.WalletWithdrawal.findAll({
      where: { status: 'pending' },
      include: [{
        model: models.WithdrawalAdmin,
        required: false
      }]
    });

    console.log(`📊 Found ${pendingWithdrawals.length} pending withdrawals`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const withdrawal of pendingWithdrawals) {
      // Check if admin record already exists
      const existingAdminRecord = await models.WithdrawalAdmin.findOne({
        where: { withdrawal_id: withdrawal.id }
      });

      if (existingAdminRecord) {
        console.log(`⏭️ Skipping withdrawal ${withdrawal.id} - admin record already exists`);
        skippedCount++;
        continue;
      }

      // Create admin record for this withdrawal
      await models.WithdrawalAdmin.create({
        withdrawal_id: withdrawal.id,
        status: 'pending',
        notes: `Withdrawal request initiated by user. Amount: ${withdrawal.amount} INR.`,
        created_at: withdrawal.created_at,
        updated_at: new Date()
      });

      console.log(`✅ Created admin record for withdrawal ${withdrawal.id}`);
      createdCount++;
    }

    console.log(`\n📈 Summary:`);
    console.log(`✅ Created: ${createdCount} admin records`);
    console.log(`⏭️ Skipped: ${skippedCount} (already existed)`);
    console.log(`📊 Total processed: ${createdCount + skippedCount}`);

    console.log('\n🎉 Withdrawal admin records population completed!');
    
  } catch (error) {
    console.error('❌ Error populating withdrawal admin records:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script if called directly
if (require.main === module) {
  populateWithdrawalAdminRecords()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { populateWithdrawalAdminRecords }; 