#!/usr/bin/env node

/**
 * Manual Period Creation Script
 * This script manually creates periods for testing when the game scheduler is not running
 */

const { redis } = require('../config/redisConfig');
const periodService = require('../services/periodService');

const createManualPeriod = async (gameType, duration) => {
    try {
        console.log(`🎮 Creating manual period for ${gameType} ${duration}s`);
        
        // Get current period using period service
        const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
        
        if (!currentPeriod) {
            console.log(`❌ Could not get current period for ${gameType} ${duration}s`);
            return false;
        }
        
        console.log(`📅 Current period: ${currentPeriod.periodId}`);
        console.log(`⏰ Time remaining: ${Math.floor(currentPeriod.timeRemaining)}s`);
        
        // Store period in Redis using the same format as game scheduler
        const periodData = {
            periodId: currentPeriod.periodId,
            gameType,
            duration,
            startTime: currentPeriod.startTime.toISOString(),
            endTime: currentPeriod.endTime.toISOString(),
            timeRemaining: Math.max(0, (currentPeriod.endTime - new Date()) / 1000),
            bettingOpen: currentPeriod.bettingOpen,
            updatedAt: new Date().toISOString(),
            source: 'manual_creation'
        };
        
        const redisKey = `game_scheduler:${gameType}:${duration}:current`;
        await redis.set(redisKey, JSON.stringify(periodData));
        await redis.expire(redisKey, 3600);
        
        console.log(`✅ Period stored in Redis with key: ${redisKey}`);
        console.log(`📊 Period data:`, periodData);
        
        return true;
        
    } catch (error) {
        console.error(`❌ Error creating manual period for ${gameType} ${duration}s:`, error);
        return false;
    }
};

const main = async () => {
    try {
        console.log('🔧 Manual Period Creation Tool');
        console.log('==============================');
        
        // Test cases
        const testCases = [
            { gameType: 'wingo', duration: 30 },
            { gameType: 'wingo', duration: 60 },
            { gameType: 'wingo', duration: 180 },
            { gameType: 'wingo', duration: 300 },
            { gameType: 'k3', duration: 60 },
            { gameType: 'k3', duration: 180 },
            { gameType: 'k3', duration: 300 },
            { gameType: 'k3', duration: 600 }
        ];
        
        let successCount = 0;
        let totalCount = testCases.length;
        
        for (const testCase of testCases) {
            const success = await createManualPeriod(testCase.gameType, testCase.duration);
            if (success) successCount++;
            console.log(''); // Empty line for readability
        }
        
        console.log(`📊 Summary: ${successCount}/${totalCount} periods created successfully`);
        
        if (successCount === totalCount) {
            console.log('✅ All periods created successfully!');
            console.log('🎮 You can now test the WebSocket connections');
        } else {
            console.log('⚠️ Some periods failed to create');
        }
        
    } catch (error) {
        console.error('❌ Manual period creation failed:', error);
    } finally {
        await redis.quit();
        process.exit(0);
    }
};

// Run the script
main(); 