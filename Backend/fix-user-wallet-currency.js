/**
 * Fix User Wallet Currency
 * This script updates user 13's third-party wallet currency from EUR to INR
 */

const { sequelize } = require('./config/db');
const ThirdPartyWallet = require('./models/ThirdPartyWallet');

async function fixUserWalletCurrency() {
  try {
    console.log('🔧 Fixing user wallet currency...');
    
    // Find user 13's wallet
    const wallet = await ThirdPartyWallet.findOne({
      where: { user_id: 13 }
    });
    
    if (!wallet) {
      console.log('❌ No wallet found for user 13');
      return;
    }
    
    console.log(`📊 Current wallet info for user 13:`);
    console.log(`   Balance: ${wallet.balance} ${wallet.currency}`);
    console.log(`   Wallet ID: ${wallet.wallet_id}`);
    console.log(`   Last Updated: ${wallet.last_updated}`);
    
    if (wallet.currency === 'INR') {
      console.log('✅ Wallet currency is already INR');
      return;
    }
    
    // Update currency to INR
    await wallet.update({
      currency: 'INR',
      last_updated: new Date()
    });
    
    console.log('✅ Successfully updated wallet currency to INR');
    console.log(`📊 Updated wallet info:`);
    console.log(`   Balance: ${wallet.balance} INR`);
    console.log(`   Last Updated: ${new Date()}`);
    
  } catch (error) {
    console.error('❌ Error fixing wallet currency:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the fix
fixUserWalletCurrency();
