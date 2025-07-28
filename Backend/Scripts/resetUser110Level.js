// scripts/resetUser110Level.js
const { getModels } = require('../models');

async function resetUser110Level() {
    try {
        console.log('🔄 Resetting User 110 Level and Adding Team Betting Field...');
        
        const models = await getModels();
        
        // First, let's add the current_team_betting column if it doesn't exist
        try {
            await models.User.sequelize.query(`
                ALTER TABLE rebet_team_table 
                ADD COLUMN current_team_betting DECIMAL(15, 2) NOT NULL DEFAULT 0.00 
                COMMENT 'Total daily betting amount by team members'
            `);
            console.log('✅ Added current_team_betting column to rebet_team_table');
        } catch (error) {
            if (error.message.includes('Duplicate column name')) {
                console.log('ℹ️ current_team_betting column already exists');
            } else {
                console.error('❌ Error adding column:', error.message);
            }
        }
        
        // Reset user 110's level to 0
        await models.RebateTeam.update({
            current_rebet_level: 0,
            current_team_betting: 0.00
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
            console.log(`   🎯 Team Betting: ₹${rebateTeam.current_team_betting}`);
        }
        
    } catch (error) {
        console.error('❌ Error resetting user 110 level:', error);
    } finally {
        process.exit(0);
    }
}

resetUser110Level(); 