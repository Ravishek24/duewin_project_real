const io = require('socket.io-client');

/**
 * 🧪 Test script to verify WebSocket countdown fix
 * This script monitors the countdown to ensure it doesn't freeze
 */

async function testWebSocketFix() {
    try {
        console.log('🧪 [WEBSOCKET_FIX_TEST] Starting WebSocket countdown test...');
        
        // Connect to WebSocket server
        const socket = io('http://localhost:3000', {
            transports: ['websocket'],
            timeout: 5000
        });
        
        let countdownReceived = false;
        let lastTimeRemaining = null;
        let stuckAtThree = false;
        let tickCount = 0;
        let lastTickTime = Date.now();
        
        socket.on('connect', () => {
            console.log('✅ [WEBSOCKET_FIX_TEST] Connected to WebSocket server');
            
            // Join 5D 60-second room
            socket.emit('joinRoom', { gameType: '5d', duration: 60 });
            console.log('🎮 [WEBSOCKET_FIX_TEST] Joined 5D 60-second room');
        });
        
        socket.on('timeUpdate', (data) => {
            const now = Date.now();
            const timeSinceLastTick = now - lastTickTime;
            lastTickTime = now;
            tickCount++;
            
            console.log(`⏰ [COUNTDOWN] t=${data.timeRemaining}s, period=${data.periodId}, tick#=${tickCount}, interval=${timeSinceLastTick}ms`);
            
            // Check for critical countdown periods
            if (data.timeRemaining <= 10) {
                console.log(`🚨 [CRITICAL] t=${data.timeRemaining}s - CRITICAL COUNTDOWN PERIOD`);
            }
            
            if (data.timeRemaining === 5) {
                console.log('🎯 [COUNTDOWN] Reached t=5s - bet freeze should start');
            }
            
            if (data.timeRemaining === 3) {
                console.log('🎯 [COUNTDOWN] Reached t=3s - pre-calculation should trigger (but not block)');
            }
            
            if (data.timeRemaining === 2) {
                console.log('✅ [COUNTDOWN] Successfully passed t=3s - countdown continuing');
                countdownReceived = true;
            }
            
            if (data.timeRemaining === 1) {
                console.log('✅ [COUNTDOWN] Reached t=1s - countdown working normally');
            }
            
            if (data.timeRemaining === 0) {
                console.log('✅ [COUNTDOWN] Reached t=0s - countdown completed successfully');
            }
            
            // Check for delays
            if (timeSinceLastTick > 1000) {
                console.log(`⚠️ [DELAY_DETECTED] ${timeSinceLastTick}ms since last tick (expected ~500ms)`);
            }
            
            // Check if stuck at t=3
            if (lastTimeRemaining === 3 && data.timeRemaining === 3) {
                stuckAtThree = true;
                console.log('❌ [COUNTDOWN] STUCK at t=3s - pre-calculation is still blocking!');
            }
            
            lastTimeRemaining = data.timeRemaining;
        });
        
        socket.on('bettingClosed', (data) => {
            console.log(`🔒 [BETTING_CLOSED] t=${data.timeRemaining}s, period=${data.periodId}`);
        });
        
        socket.on('gameResult', (data) => {
            console.log(`🎲 [GAME_RESULT] Result received for period ${data.periodId}`);
        });
        
        socket.on('disconnect', () => {
            console.log('❌ [WEBSOCKET_FIX_TEST] Disconnected from WebSocket server');
        });
        
        socket.on('error', (error) => {
            console.error('❌ [WEBSOCKET_FIX_TEST] WebSocket error:', error);
        });
        
        // Wait for countdown to complete or timeout
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('⏰ [WEBSOCKET_FIX_TEST] Test timeout reached');
                resolve();
            }, 120000); // 2 minutes timeout
            
            // Check for successful countdown
            const checkInterval = setInterval(() => {
                if (countdownReceived) {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    console.log('✅ [WEBSOCKET_FIX_TEST] Countdown test completed successfully');
                    resolve();
                }
            }, 1000);
        });
        
        // Disconnect
        socket.disconnect();
        
        // Results
        console.log('\n📊 [WEBSOCKET_FIX_TEST] Test Results:');
        console.log(`   Total ticks received: ${tickCount}`);
        console.log(`   Countdown continued past t=3s: ${countdownReceived ? '✅' : '❌'}`);
        console.log(`   Stuck at t=3s: ${stuckAtThree ? '❌' : '✅'}`);
        
        if (countdownReceived && !stuckAtThree) {
            console.log('🎉 [WEBSOCKET_FIX_TEST] SUCCESS: WebSocket countdown is working properly!');
            return { success: true, tickCount, countdownReceived, stuckAtThree };
        } else {
            console.log('❌ [WEBSOCKET_FIX_TEST] FAILED: WebSocket countdown is still freezing!');
            return { success: false, tickCount, countdownReceived, stuckAtThree };
        }
        
    } catch (error) {
        console.error('❌ [WEBSOCKET_FIX_TEST] Test failed:', error);
        return { success: false, error: error.message };
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testWebSocketFix()
        .then(result => {
            if (result.success) {
                console.log('\n🎉 [WEBSOCKET_FIX_TEST] All tests passed!');
                process.exit(0);
            } else {
                console.log('\n❌ [WEBSOCKET_FIX_TEST] Tests failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ [WEBSOCKET_FIX_TEST] Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    testWebSocketFix
}; 