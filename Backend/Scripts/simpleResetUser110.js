// scripts/simpleResetUser110.js
const { getModels } = require('../models');

async function simpleResetUser110() {
    try {
        console.log('🔄 Resetting User 110 Level to 0...');
        
        const models = await getModels();
        
        // Reset user 110's level to 0
        await models.RebateTeam.update({
            current_rebet_level: 0
        }, {
            where: { user_id: 110 }
        });
        
        console.log('✅ Reset user 110 level to 0');
        
        // Verify the change
        const rebateTeam = await models.RebateTeam.findOne({
            where: { user_id: 110 },
            include: [{
                model: models.User,
                as: 'user',
                attributes: ['user_id', 'user_name']
            }]
        });
        
        if (rebateTeam) {
            console.log(`\n📊 User 110 Updated:`);
            console.log(`   👤 User: ${rebateTeam.user.user_name}`);
            console.log(`   📈 Level: ${rebateTeam.current_rebet_level}`);
            console.log(`   👥 Team Size: ${rebateTeam.current_team_number}`);
            console.log(`   💰 Team Deposits: ₹${rebateTeam.current_deposit}`);
        }
        
    } catch (error) {
        console.error('❌ Error resetting user 110 level:', error);
    } finally {
        process.exit(0);
    }
}

simpleResetUser110(); 