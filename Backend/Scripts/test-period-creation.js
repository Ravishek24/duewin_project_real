#!/usr/bin/env node

/**
 * Test script to verify period creation and Redis storage
 * This script checks if the game scheduler is creating periods correctly
 */

const { redis } = require('../config/redisConfig');
const periodService = require('../services/periodService');

const testPeriodCreation = async () => {
    try {
        console.log('🧪 Testing Period Creation and Redis Storage');
        console.log('=============================================');
        
        // Test game types and durations
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
        
        for (const testCase of testCases) {
            const { gameType, duration } = testCase;
            console.log(`\n📋 Testing ${gameType} ${duration}s periods:`);
            
            // 1. Check if game scheduler is storing periods
            const schedulerKey = `game_scheduler:${gameType}:${duration}:current`;
            const schedulerData = await redis.get(schedulerKey);
            
            if (schedulerData) {
                const periodInfo = JSON.parse(schedulerData);
                console.log(`   ✅ Game Scheduler Data Found:`);
                console.log(`      - Period ID: ${periodInfo.periodId}`);
                console.log(`      - Start Time: ${periodInfo.startTime}`);
                console.log(`      - End Time: ${periodInfo.endTime}`);
                console.log(`      - Time Remaining: ${periodInfo.timeRemaining}s`);
                console.log(`      - Betting Open: ${periodInfo.bettingOpen}`);
                console.log(`      - Source: ${periodInfo.source}`);
            } else {
                console.log(`   ❌ No Game Scheduler Data Found`);
                console.log(`      - Key: ${schedulerKey}`);
            }
            
            // 2. Check if period service can get current period
            try {
                const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
                if (currentPeriod) {
                    console.log(`   ✅ Period Service Current Period:`);
                    console.log(`      - Period ID: ${currentPeriod.periodId}`);
                    console.log(`      - Time Remaining: ${Math.floor(currentPeriod.timeRemaining)}s`);
                    console.log(`      - Active: ${currentPeriod.active}`);
                    console.log(`      - Betting Open: ${currentPeriod.bettingOpen}`);
                } else {
                    console.log(`   ❌ Period Service returned null`);
                }
            } catch (error) {
                console.log(`   ❌ Period Service Error: ${error.message}`);
            }
            
            // 3. Check if period is initialized in Redis
            const durationKey = duration === 30 ? '30s' : 
                               duration === 60 ? '1m' : 
                               duration === 180 ? '3m' : 
                               duration === 300 ? '5m' : '10m';
            
            if (schedulerData) {
                const periodInfo = JSON.parse(schedulerData);
                const periodKey = `${gameType}:${durationKey}:${periodInfo.periodId}`;
                const betsKey = `${periodKey}:bets`;
                const resultKey = `${periodKey}:result`;
                
                const periodExists = await redis.exists(periodKey);
                const betsExist = await redis.exists(betsKey);
                const resultExists = await redis.exists(resultKey);
                
                console.log(`   📊 Redis Period Keys:`);
                console.log(`      - Period Data: ${periodExists ? '✅' : '❌'} (${periodKey})`);
                console.log(`      - Bets Data: ${betsExist ? '✅' : '❌'} (${betsKey})`);
                console.log(`      - Result Data: ${resultExists ? '✅' : '❌'} (${resultKey})`);
            }
        }
        
        // 4. Check Redis connection
        console.log('\n🔗 Redis Connection Status:');
        const redisStatus = redis.status;
        console.log(`   - Status: ${redisStatus}`);
        console.log(`   - Connected: ${redisStatus === 'ready' ? '✅' : '❌'}`);
        
        // 5. Check for any Redis keys related to periods
        console.log('\n🔍 Redis Keys Scan:');
        const keys = await redis.keys('*period*');
        console.log(`   - Found ${keys.length} period-related keys`);
        if (keys.length > 0) {
            console.log(`   - Sample keys: ${keys.slice(0, 5).join(', ')}`);
        }
        
        // 6. Check for game scheduler keys
        const schedulerKeys = await redis.keys('game_scheduler:*');
        console.log(`   - Found ${schedulerKeys.length} game scheduler keys`);
        if (schedulerKeys.length > 0) {
            console.log(`   - Scheduler keys: ${schedulerKeys.join(', ')}`);
        }
        
        console.log('\n✅ Period Creation Test Completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        // Close Redis connection
        await redis.quit();
        process.exit(0);
    }
};

// Run the test
testPeriodCreation(); 