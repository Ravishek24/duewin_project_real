const fiveDProtectionService = require('./services/fiveDProtectionService');
const gameLogicService = require('./services/gameLogicService');

/**
 * Integration example: How to use 5D protection service in your existing game logic
 */
async function integrate5DProtection() {
    console.log('🔗 [5D_INTEGRATION] ==========================================');
    console.log('🔗 [5D_INTEGRATION] 5D Protection Integration Guide');
    console.log('🔗 [5D_INTEGRATION] ==========================================');

    // Example 1: Initialize at period start
    console.log('\n📋 [STEP_1] Initialize zero-exposure candidates at period start');
    console.log(`
    // In your period start logic:
    const gameType = '5d';
    const duration = 60;
    const periodId = '5D_20241201_001';
    const timeline = 'default';
    
    // Initialize zero-exposure candidates
    await fiveDProtectionService.initializeZeroExposureCandidates(
        gameType, duration, periodId, timeline
    );
    `);

    // Example 2: Remove combinations when bet is placed
    console.log('\n📋 [STEP_2] Remove combinations when bet is placed');
    console.log(`
    // In your bet placement logic:
    const betType = 'POSITION';
    const betValue = 'A_5';
    
    // Remove winning combinations from zero-exposure set
    await fiveDProtectionService.removeCombinationFromZeroExposure(
        gameType, duration, periodId, timeline,
        betType, betValue
    );
    `);

    // Example 3: Use protection in result generation
    console.log('\n📋 [STEP_3] Use protection in result generation');
    console.log(`
    // In your result generation logic:
    async function generate5DResult(gameType, duration, periodId, timeline) {
        // Check if protection is needed
        const userCountResult = await gameLogicService.getUniqueUserCount(
            gameType, duration, periodId, timeline
        );
        
        const shouldUseProtectedResult = userCountResult.uniqueUserCount < 
            gameLogicService.ENHANCED_USER_THRESHOLD;
        
        if (shouldUseProtectedResult) {
            // Use 5D protection service (60/40 logic)
            return await fiveDProtectionService.getProtectedResult(
                gameType, duration, periodId, timeline
            );
        } else {
            // Use normal random result
            return await gameLogicService.generateRandom5DResult();
        }
    }
    `);

    // Example 4: Complete integration example
    console.log('\n📋 [STEP_4] Complete integration example');
    console.log(`
    // Complete 5D result generation with protection:
    
    async function generate5DResultWithProtection(gameType, duration, periodId, timeline) {
        try {
            // 1. Check user count
            const userCountResult = await gameLogicService.getUniqueUserCount(
                gameType, duration, periodId, timeline
            );
            
            console.log(\`User count: \${userCountResult.uniqueUserCount}, Threshold: \${gameLogicService.ENHANCED_USER_THRESHOLD}\`);
            
            // 2. Decide protection strategy
            const shouldUseProtectedResult = userCountResult.uniqueUserCount < 
                gameLogicService.ENHANCED_USER_THRESHOLD;
            
            let result;
            
            if (shouldUseProtectedResult) {
                console.log('🛡️ Using 5D protection logic');
                
                // 3. Use 5D protection service (60/40 logic)
                result = await fiveDProtectionService.getProtectedResult(
                    gameType, duration, periodId, timeline
                );
                
                console.log('✅ Protected result generated:', result);
            } else {
                console.log('🎲 Using normal random result');
                
                // 4. Use normal random result
                result = await gameLogicService.generateRandom5DResult();
                
                console.log('✅ Random result generated:', result);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Error generating 5D result:', error);
            throw error;
        }
    }
    `);

    // Example 5: Bet placement integration
    console.log('\n📋 [STEP_5] Bet placement integration');
    console.log(`
    // In your bet placement logic:
    
    async function place5DBet(userId, betType, betValue, amount, periodId) {
        try {
            // 1. Validate bet
            const validation = await validateBet(betType, betValue, amount);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            // 2. Process bet (your existing logic)
            const betResult = await processBet(userId, betType, betValue, amount, periodId);
            
            // 3. Remove combinations from zero-exposure set
            const gameType = '5d';
            const duration = 60;
            const timeline = 'default';
            
            await fiveDProtectionService.removeCombinationFromZeroExposure(
                gameType, duration, periodId, timeline,
                betType, betValue
            );
            
            console.log(\`✅ Bet placed and combinations removed for: \${betType}:\${betValue}\`);
            
            return betResult;
            
        } catch (error) {
            console.error('❌ Error placing bet:', error);
            throw error;
        }
    }
    `);

    // Example 6: Period management
    console.log('\n📋 [STEP_6] Period management');
    console.log(`
    // Period start:
    async function start5DPeriod(periodId) {
        const gameType = '5d';
        const duration = 60;
        const timeline = 'default';
        
        // Initialize zero-exposure candidates
        await fiveDProtectionService.initializeZeroExposureCandidates(
            gameType, duration, periodId, timeline
        );
        
        console.log(\`✅ 5D period started: \${periodId}\`);
    }
    
    // Period end:
    async function end5DPeriod(periodId) {
        const gameType = '5d';
        const duration = 60;
        const timeline = 'default';
        
        // Clean up Redis keys (optional)
        const setKey = fiveDProtectionService.getZeroExposureSetKey(
            gameType, duration, periodId, timeline
        );
        await redisClient.del(setKey);
        
        console.log(\`✅ 5D period ended: \${periodId}\`);
    }
    `);

    // Example 7: Monitoring and debugging
    console.log('\n📋 [STEP_7] Monitoring and debugging');
    console.log(`
    // Get protection statistics:
    async function get5DProtectionStats(periodId) {
        const gameType = '5d';
        const duration = 60;
        const timeline = 'default';
        
        const stats = await fiveDProtectionService.getProtectionStats(
            gameType, duration, periodId, timeline
        );
        
        console.log('5D Protection Stats:', stats);
        return stats;
    }
    
    // Monitor protection effectiveness:
    async function monitor5DProtection(periodId) {
        const stats = await get5DProtectionStats(periodId);
        
        const zeroExposurePercentage = (stats.remainingZeroExposure / stats.totalCombinations) * 100;
        
        console.log(\`Zero-exposure combinations: \${stats.remainingZeroExposure}/\${stats.totalCombinations} (\${zeroExposurePercentage.toFixed(2)}%)\`);
        
        if (zeroExposurePercentage < 10) {
            console.log('⚠️ Warning: Low zero-exposure combinations remaining');
        }
    }
    `);

    console.log('\n🎯 [5D_INTEGRATION] ==========================================');
    console.log('🎯 [5D_INTEGRATION] Integration guide completed!');
    console.log('🎯 [5D_INTEGRATION] ==========================================');
}

// Run the integration guide
integrate5DProtection().catch(console.error); 