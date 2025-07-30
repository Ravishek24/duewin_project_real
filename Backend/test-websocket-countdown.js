const io = require('socket.io-client');

async function testWebSocketCountdown() {
    console.log('🧪 [WEBSOCKET_COUNTDOWN] Testing websocket countdown without blocking...');
    
    try {
        // Connect to websocket
        const socket = io('http://localhost:3000', {
            transports: ['websocket']
        });
        
        let countdownReceived = false;
        let stuckAtThree = false;
        let lastTimeRemaining = null;
        
        socket.on('connect', () => {
            console.log('✅ Connected to websocket server');
            
            // Join a 5D room to trigger pre-calculation
            socket.emit('joinRoom', {
                gameType: 'fiveD',
                duration: 60
            });
            
            console.log('📡 Joined 5D room, monitoring countdown...');
        });
        
        socket.on('timeUpdate', (data) => {
            console.log(`⏰ [COUNTDOWN] t=${data.timeRemaining}s, period=${data.periodId}`);
            
            if (data.timeRemaining === 3) {
                console.log('🎯 [COUNTDOWN] Reached t=3s - pre-calculation should trigger');
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
            
            // Check if stuck at t=3
            if (lastTimeRemaining === 3 && data.timeRemaining === 3) {
                stuckAtThree = true;
                console.log('❌ [COUNTDOWN] STUCK at t=3s - pre-calculation is blocking!');
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
            console.log('❌ Disconnected from websocket server');
        });
        
        // Wait for countdown to complete or timeout
        await new Promise((resolve) => {
            setTimeout(() => {
                console.log('\n📋 WEBSOCKET COUNTDOWN TEST RESULTS:');
                console.log('├─ Countdown received:', countdownReceived ? '✅ YES' : '❌ NO');
                console.log('├─ Stuck at t=3:', stuckAtThree ? '❌ YES' : '✅ NO');
                console.log('├─ Last time remaining:', lastTimeRemaining);
                console.log('└─ Test duration: 30 seconds');
                
                if (countdownReceived && !stuckAtThree) {
                    console.log('\n🎉 WEBSOCKET COUNTDOWN: SUCCESS!');
                    console.log('🚀 Countdown continues normally without blocking!');
                    console.log('⚡ Pre-calculation runs in background!');
                } else if (stuckAtThree) {
                    console.log('\n❌ WEBSOCKET COUNTDOWN: FAILED!');
                    console.log('🔧 Countdown is stuck at t=3s');
                    console.log('🔧 Pre-calculation is blocking the countdown');
                } else {
                    console.log('\n⚠️ WEBSOCKET COUNTDOWN: INCOMPLETE!');
                    console.log('🔧 Test timeout - countdown may still be working');
                }
                
                socket.disconnect();
                resolve();
            }, 30000); // 30 second timeout
        });
        
    } catch (error) {
        console.error('❌ [WEBSOCKET_COUNTDOWN] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testWebSocketCountdown().then(() => {
    console.log('\n🏁 [WEBSOCKET_COUNTDOWN] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [WEBSOCKET_COUNTDOWN] Test failed:', error);
    process.exit(1);
}); 