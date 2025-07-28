// scripts/testCommissionCalculation.js
const { getModels } = require('../models');
const unifiedRedis = require('../config/unifiedRedisManager');

async function testCommissionCalculation() {
    try {
        console.log('🧮 Testing Commission Calculation Logic...');
        await unifiedRedis.initialize();
        const models = await getModels();

        // Test data
        const testCases = [
            {
                userLevel: 0,
                level1Bets: 10000,
                level2Bets: 5000,
                level3Bets: 2000,
                expectedLevel1Rate: 0.006, // 0.6%
                expectedLevel2Rate: 0.0018, // 0.18%
                expectedLevel3Rate: 0.00054 // 0.054%
            },
            {
                userLevel: 1,
                level1Bets: 15000,
                level2Bets: 8000,
                level3Bets: 3000,
                expectedLevel1Rate: 0.007, // 0.7%
                expectedLevel2Rate: 0.00245, // 0.245%
                expectedLevel3Rate: 0.0008575 // 0.08575%
            },
            {
                userLevel: 2,
                level1Bets: 20000,
                level2Bets: 12000,
                level3Bets: 5000,
                expectedLevel1Rate: 0.0075, // 0.75%
                expectedLevel2Rate: 0.002815, // 0.2815%
                expectedLevel3Rate: 0.00105469 // 0.105469%
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n📊 Testing Level ${testCase.userLevel} User:`);
            
            // Get rebate level details
            const rebateLevel = await models.RebateLevel.findOne({
                where: { level: testCase.userLevel }
            });

            if (!rebateLevel) {
                console.log(`❌ No rebate level found for level ${testCase.userLevel}`);
                continue;
            }

            console.log(`✅ Found rebate level: ${rebateLevel.level}`);

            // Test commission calculation for each level
            for (let level = 1; level <= 3; level++) {
                const rateField = `lottery_l${level}_rebate`;
                const actualRate = parseFloat(rebateLevel[rateField] || 0);
                const expectedRate = testCase[`expectedLevel${level}Rate`];
                const bets = testCase[`level${level}Bets`];
                
                // Calculate commission using the same logic as enhancedRebateService
                const commission = bets * (actualRate / 100);
                
                console.log(`   Level ${level} Referrals:`);
                console.log(`     Bets: ₹${bets.toFixed(2)}`);
                console.log(`     Rate: ${actualRate} (${(actualRate * 100).toFixed(3)}%)`);
                console.log(`     Commission: ₹${commission.toFixed(4)}`);
                
                // Verify rate matches expected
                if (Math.abs(actualRate - expectedRate) < 0.0001) {
                    console.log(`     ✅ Rate matches expected`);
                } else {
                    console.log(`     ❌ Rate mismatch: expected ${expectedRate}, got ${actualRate}`);
                }
            }

            // Calculate total commission for all levels
            let totalCommission = 0;
            for (let level = 1; level <= 3; level++) {
                const rateField = `lottery_l${level}_rebate`;
                const rate = parseFloat(rebateLevel[rateField] || 0);
                const bets = testCase[`level${level}Bets`];
                totalCommission += bets * (rate / 100);
            }
            
            console.log(`   💰 Total Daily Commission: ₹${totalCommission.toFixed(4)}`);
        }

        // Test with real data from database
        console.log('\n🔍 Testing with Real Database Data:');
        
        // Get a sample user with rebate team data
        const sampleUser = await models.RebateTeam.findOne({
            include: [{
                model: models.User,
                as: 'user',
                attributes: ['user_id', 'user_name']
            }],
            limit: 1
        });

        if (sampleUser) {
            console.log(`\n👤 Sample User: ${sampleUser.user.user_name} (ID: ${sampleUser.user_id})`);
            console.log(`   Current Level: ${sampleUser.current_rebet_level}`);
            console.log(`   Team Size: ${sampleUser.current_team_number}`);
            console.log(`   Team Deposits: ₹${sampleUser.current_deposit}`);
            
            // Get their rebate level details
            const userRebateLevel = await models.RebateLevel.findOne({
                where: { level: sampleUser.current_rebet_level }
            });

            if (userRebateLevel) {
                console.log(`\n📈 Commission Rates for Level ${userRebateLevel.level}:`);
                for (let level = 1; level <= 6; level++) {
                    const rateField = `lottery_l${level}_rebate`;
                    const rate = parseFloat(userRebateLevel[rateField] || 0);
                    console.log(`   Level ${level}: ${rate} (${(rate * 100).toFixed(3)}%)`);
                }
            }
        }

        console.log('\n✅ Commission calculation test completed!');

    } catch (error) {
        console.error('❌ Error testing commission calculation:', error);
    } finally {
        await unifiedRedis.close();
        process.exit(0);
    }
}

testCommissionCalculation(); 