// Test script to verify rebate commission calculations are fixed
const { sequelize } = require('./config/db');
const models = require('./models');

async function testCommissionCalculations() {
    try {
        console.log('🧪 Testing Rebate Commission Calculations\n');
        
        // Get rebate level data
        const rebateLevel = await models.RebateLevel.findOne({
            where: { level: '1' }  // Assuming user 191 is on level 1
        });
        
        if (!rebateLevel) {
            console.log('❌ No rebate level found');
            return;
        }
        
        console.log('📊 Rebate Level Rates:');
        for (let level = 1; level <= 6; level++) {
            const rateField = `lottery_l${level}_rebate`;
            const rate = parseFloat(rebateLevel[rateField] || 0);
            console.log(`Level ${level}: ${rate} (${(rate * 100).toFixed(3)}%)`);
        }
        
        console.log('\n💰 Expected Commissions for ₹1000 bet:');
        const betAmount = 1000;
        
        for (let level = 1; level <= 6; level++) {
            const rateField = `lottery_l${level}_rebate`;
            const rate = parseFloat(rebateLevel[rateField] || 0);
            const expectedCommission = betAmount * rate;
            console.log(`Level ${level}: ₹${betAmount} × ${rate} = ₹${expectedCommission.toFixed(2)}`);
        }
        
        console.log('\n🔍 Current Commission Records for User 191:');
        const commissions = await models.ReferralCommission.findAll({
            where: { user_id: 191 },
            order: [['level', 'ASC'], ['created_at', 'DESC']],
            limit: 12
        });
        
        console.log('Level | Amount | Expected | Match | User ID');
        console.log('------|--------|----------|-------|--------');
        
        for (const commission of commissions) {
            const level = commission.level;
            const amount = parseFloat(commission.amount);
            const rateField = `lottery_l${level}_rebate`;
            const rate = parseFloat(rebateLevel[rateField] || 0);
            const expected = 1000 * rate; // Assuming ₹1000 bet
            const match = Math.abs(amount - expected) < 0.01 ? '✅' : '❌';
            
            console.log(`${level.toString().padStart(5)} | ${amount.toFixed(2).padStart(6)} | ${expected.toFixed(2).padStart(8)} | ${match.padStart(5)} | ${commission.referred_user_id}`);
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testCommissionCalculations();
