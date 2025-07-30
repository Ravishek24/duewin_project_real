const io = require('socket.io-client');

async function testWebSocketAllGames() {
    console.log('🧪 [WEBSOCKET_ALL_GAMES] Testing websocket countdown for all games...');
    
    try {
        // Connect to websocket
        const socket = io('http://localhost:3000', {
            transports: ['websocket']
        });
        
        const gameResults = {
            wingo: { countdownReceived: false, stuckAtThree: false, lastTimeRemaining: null },
            fiveD: { countdownReceived: false, stuckAtThree: false, lastTimeRemaining: null },
            k3: { countdownReceived: false, stuckAtThree: false, lastTimeRemaining: null }
        };
        
        socket.on('connect', () => {
            console.log('✅ Connected to websocket server');
            
            // Join multiple game rooms to test all games
            socket.emit('joinRoom', { gameType: 'wingo', duration: 30 });
            socket.emit('joinRoom', { gameType: 'fiveD', duration: 60 });
            socket.emit('joinRoom', { gameType: 'k3', duration: 60 });
            
            console.log('📡 Joined multiple game rooms, monitoring countdowns...');
        });
        
        socket.on('timeUpdate', (data) => {
            const gameKey = data.gameType.toLowerCase();
            if (gameResults[gameKey]) {
                console.log(`⏰ [${data.gameType.toUpperCase()}] t=${data.timeRemaining}s, period=${data.periodId}`);
                
                if (data.timeRemaining === 3) {
                    console.log(`🎯 [${data.gameType.toUpperCase()}] Reached t=3s`);
                }
                
                if (data.timeRemaining === 2) {
                    console.log(`✅ [${data.gameType.toUpperCase()}] Successfully passed t=3s - countdown continuing`);
                    gameResults[gameKey].countdownReceived = true;
                }
                
                if (data.timeRemaining === 1) {
                    console.log(`✅ [${data.gameType.toUpperCase()}] Reached t=1s - countdown working normally`);
                }
                
                if (data.timeRemaining === 0) {
                    console.log(`✅ [${data.gameType.toUpperCase()}] Reached t=0s - countdown completed successfully`);
                }
                
                // Check if stuck at t=3
                if (gameResults[gameKey].lastTimeRemaining === 3 && data.timeRemaining === 3) {
                    gameResults[gameKey].stuckAtThree = true;
                    console.log(`❌ [${data.gameType.toUpperCase()}] STUCK at t=3s - processing is blocking!`);
                }
                
                gameResults[gameKey].lastTimeRemaining = data.timeRemaining;
            }
        });
        
        socket.on('bettingClosed', (data) => {
            console.log(`🔒 [BETTING_CLOSED] ${data.gameType}: t=${data.timeRemaining}s, period=${data.periodId}`);
        });
        
        socket.on('gameResult', (data) => {
            console.log(`🎲 [GAME_RESULT] ${data.gameType}: Result received for period ${data.periodId}`);
        });
        
        socket.on('periodStart', (data) => {
            console.log(`🚀 [PERIOD_START] ${data.gameType}: New period ${data.periodId} started`);
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Disconnected from websocket server');
        });
        
        // Wait for countdown to complete or timeout
        await new Promise((resolve) => {
            setTimeout(() => {
                console.log('\n📋 WEBSOCKET ALL GAMES TEST RESULTS:');
                
                let allGamesWorking = true;
                let anyGameStuck = false;
                
                for (const [gameType, results] of Object.entries(gameResults)) {
                    console.log(`\n${gameType.toUpperCase()}:`);
                    console.log(`├─ Countdown received:`, results.countdownReceived ? '✅ YES' : '❌ NO');
                    console.log(`├─ Stuck at t=3:`, results.stuckAtThree ? '❌ YES' : '✅ NO');
                    console.log(`└─ Last time remaining:`, results.lastTimeRemaining);
                    
                    if (!results.countdownReceived || results.stuckAtThree) {
                        allGamesWorking = false;
                    }
                    if (results.stuckAtThree) {
                        anyGameStuck = true;
                    }
                }
                
                console.log('\n📊 OVERALL RESULTS:');
                console.log('├─ All games working:', allGamesWorking ? '✅ YES' : '❌ NO');
                console.log('├─ Any game stuck:', anyGameStuck ? '❌ YES' : '✅ NO');
                console.log('└─ Test duration: 60 seconds');
                
                if (allGamesWorking && !anyGameStuck) {
                    console.log('\n🎉 WEBSOCKET ALL GAMES: SUCCESS!');
                    console.log('🚀 All games countdown normally without blocking!');
                    console.log('⚡ Background processing working for all games!');
                    console.log('🎯 No more stuck countdowns!');
                } else if (anyGameStuck) {
                    console.log('\n❌ WEBSOCKET ALL GAMES: FAILED!');
                    console.log('🔧 Some games are still getting stuck at t=3s');
                    console.log('🔧 Background processing may not be working properly');
                } else {
                    console.log('\n⚠️ WEBSOCKET ALL GAMES: INCOMPLETE!');
                    console.log('🔧 Test timeout - countdowns may still be working');
                }
                
                socket.disconnect();
                resolve();
            }, 60000); // 60 second timeout
        });
        
    } catch (error) {
        console.error('❌ [WEBSOCKET_ALL_GAMES] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testWebSocketAllGames().then(() => {
    console.log('\n🏁 [WEBSOCKET_ALL_GAMES] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [WEBSOCKET_ALL_GAMES] Test failed:', error);
    process.exit(1);
}); 