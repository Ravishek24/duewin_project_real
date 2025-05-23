const { sequelize } = require('../config/db');
const VipLevel = require('../models/VipLevel');

const vipLevels = [
    {
        level: 1,
        name: 'VIP 1',
        exp_required: 1000,
        bonus_amount: 100.00,
        monthly_reward: 50.00,
        rebate_rate: 0.50
    },
    {
        level: 2,
        name: 'VIP 2',
        exp_required: 5000,
        bonus_amount: 200.00,
        monthly_reward: 100.00,
        rebate_rate: 1.00
    },
    {
        level: 3,
        name: 'VIP 3',
        exp_required: 10000,
        bonus_amount: 500.00,
        monthly_reward: 200.00,
        rebate_rate: 1.50
    },
    {
        level: 4,
        name: 'VIP 4',
        exp_required: 50000,
        bonus_amount: 1000.00,
        monthly_reward: 500.00,
        rebate_rate: 2.00
    },
    {
        level: 5,
        name: 'VIP 5',
        exp_required: 100000,
        bonus_amount: 2000.00,
        monthly_reward: 1000.00,
        rebate_rate: 2.50
    },
    {
        level: 6,
        name: 'VIP 6',
        exp_required: 500000,
        bonus_amount: 5000.00,
        monthly_reward: 2000.00,
        rebate_rate: 3.00
    },
    {
        level: 7,
        name: 'VIP 7',
        exp_required: 1000000,
        bonus_amount: 10000.00,
        monthly_reward: 5000.00,
        rebate_rate: 3.50
    },
    {
        level: 8,
        name: 'VIP 8',
        exp_required: 5000000,
        bonus_amount: 20000.00,
        monthly_reward: 10000.00,
        rebate_rate: 4.00
    },
    {
        level: 9,
        name: 'VIP 9',
        exp_required: 10000000,
        bonus_amount: 50000.00,
        monthly_reward: 20000.00,
        rebate_rate: 4.50
    },
    {
        level: 10,
        name: 'VIP 10',
        exp_required: 50000000,
        bonus_amount: 100000.00,
        monthly_reward: 50000.00,
        rebate_rate: 5.00
    }
];

async function updateVipLevels() {
    try {
        // Start a transaction
        const t = await sequelize.transaction();

        try {
            // Clear existing VIP levels
            await VipLevel.destroy({ where: {}, transaction: t });

            // Insert new VIP levels
            for (const level of vipLevels) {
                await VipLevel.create({
                    ...level,
                    created_at: new Date(),
                    updated_at: new Date()
                }, { transaction: t });
            }

            // Commit the transaction
            await t.commit();
            console.log('VIP levels updated successfully!');
            
            // Display the updated levels
            const updatedLevels = await VipLevel.findAll({
                order: [['level', 'ASC']]
            });
            
            console.log('\nUpdated VIP Levels:');
            console.log('------------------');
            updatedLevels.forEach(level => {
                console.log(`Level ${level.level} (${level.name}):`);
                console.log(`  Experience Required: ${level.exp_required}`);
                console.log(`  Bonus Amount: ${level.bonus_amount}`);
                console.log(`  Monthly Reward: ${level.monthly_reward}`);
                console.log(`  Rebate Rate: ${level.rebate_rate}%`);
                console.log('------------------');
            });

        } catch (error) {
            // If an error occurs, rollback the transaction
            await t.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error updating VIP levels:', error);
    } finally {
        // Close the database connection
        await sequelize.close();
    }
}

// Run the update
updateVipLevels(); 