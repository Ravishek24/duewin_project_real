const { io } = require('socket.io-client');

async function testEnhancedExposureWebSocket() {
    console.log('🧪 [TEST] Testing Enhanced Exposure WebSocket');
    
    try {
        // Connect to admin namespace
        const socket = io('http://localhost:3000/admin', {
            auth: {
                token: 'your-admin-jwt-token' // Replace with actual token
            }
        });

        socket.on('connect', () => {
            console.log('✅ Connected to admin WebSocket');
            
            // Subscribe to enhanced exposure for 30s duration
            socket.emit('subscribeToWingoExposure', { duration: 30 });
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from WebSocket');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
        });

        // Listen for enhanced exposure updates
        socket.on('wingoExposureUpdate', (data) => {
            console.log('📊 Enhanced Exposure Update Received:');
            console.log('Success:', data.success);
            console.log('Duration:', data.duration);
            console.log('Period ID:', data.periodId);
            
            if (data.numbers) {
                console.log('\n📈 Numbers with User Counts:');
                Object.entries(data.numbers).forEach(([number, info]) => {
                    console.log(`Number ${number}: ₹${(info.amount / 100).toFixed(2)} | 👥 ${info.users} users | 💰 ₹${info.totalBetAmount.toFixed(2)}`);
                });
            }
            
            if (data.periodSummary) {
                console.log('\n📊 Period Summary:');
                console.log('Total Users:', data.periodSummary.totalUsers);
                console.log('Total Bet Amount:', data.periodSummary.totalBetAmount);
                console.log('Unique Users:', data.periodSummary.uniqueUsers);
                console.log('Total Bets:', data.periodSummary.totalBets);
            }
            
            if (data.userDetails) {
                console.log('\n👥 User Details Available for Numbers:');
                Object.entries(data.userDetails).forEach(([number, users]) => {
                    if (users.length > 0) {
                        console.log(`Number ${number}: ${users.length} users`);
                    }
                });
            }
            
            console.log('\n' + '='.repeat(50));
        });

        // Test getting user details for a specific number
        setTimeout(() => {
            console.log('\n🔍 Testing User Details for Number 0...');
            socket.emit('getUserDetailsForNumber', { duration: 30, number: 0 });
        }, 2000);

        socket.on('userDetailsForNumber', (data) => {
            console.log('\n👤 User Details Response:');
            console.log('Success:', data.success);
            console.log('Number:', data.number);
            console.log('Duration:', data.duration);
            
            if (data.users && data.users.length > 0) {
                console.log('\n📋 User Bets:');
                data.users.forEach((user, index) => {
                    console.log(`${index + 1}. User: ${user.userId}`);
                    console.log(`   Bet Amount: ₹${user.betAmount.toFixed(2)}`);
                    console.log(`   Bet Type: ${user.betType}`);
                    console.log(`   Bet Value: ${user.betValue}`);
                    console.log(`   Timestamp: ${new Date(user.timestamp).toLocaleString()}`);
                    console.log('');
                });
            } else {
                console.log('No users found for this number');
            }
            
            if (data.statistics) {
                console.log('📊 Statistics:');
                console.log('Total Users:', data.statistics.totalUsers);
                console.log('Total Bet Amount:', data.statistics.totalBetAmount);
                console.log('Unique Users:', data.statistics.uniqueUsers);
                console.log('Bet Types:', data.statistics.betTypes);
            }
        });

        // Keep connection alive for 10 seconds
        setTimeout(() => {
            console.log('\n🏁 Test completed. Disconnecting...');
            socket.disconnect();
            process.exit(0);
        }, 10000);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testEnhancedExposureWebSocket(); 