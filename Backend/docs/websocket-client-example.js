// WebSocket client example for Wingo game monitoring
const WebSocket = require('ws');

// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:3000');

// Subscribe to a specific timeline
const subscribeToTimeline = (timeline) => {
    ws.send(JSON.stringify({
        type: 'subscribe',
        timeline: timeline
    }));
};

// Handle incoming messages
ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);
        
        switch(message.type) {
            case 'period_update':
                console.log('\n=== Period Update ===');
                console.log('Timeline:', message.data.timeline);
                console.log('Period ID:', message.data.period.period_id);
                console.log('Time Remaining:', message.data.period.time_remaining, 'seconds');
                console.log('Total Bet Amount:', message.data.period.total_bet_amount);
                console.log('Unique Bettors:', message.data.period.unique_bettors);
                
                // Display betting statistics
                console.log('\nBetting Statistics:');
                
                // Numbers
                console.log('\nNumbers:');
                message.data.period.betting_stats.numbers.forEach(stat => {
                    if (stat.total_amount > 0) {
                        console.log(`Number ${stat.number}: ${stat.total_amount} (${stat.bet_count} bets)`);
                    }
                });
                
                // Colors
                console.log('\nColors:');
                message.data.period.betting_stats.colors.forEach(stat => {
                    if (stat.total_amount > 0) {
                        console.log(`${stat.color}: ${stat.total_amount} (${stat.bet_count} bets)`);
                    }
                });
                
                // Odd/Even
                console.log('\nOdd/Even:');
                message.data.period.betting_stats.odd_even.forEach(stat => {
                    if (stat.total_amount > 0) {
                        console.log(`${stat.type}: ${stat.total_amount} (${stat.bet_count} bets)`);
                    }
                });
                
                // Size
                console.log('\nSize:');
                message.data.period.betting_stats.size.forEach(stat => {
                    if (stat.total_amount > 0) {
                        console.log(`${stat.size}: ${stat.total_amount} (${stat.bet_count} bets)`);
                    }
                });
                
                // Recent bets
                console.log('\nRecent Bets:');
                message.data.period.bets.slice(-5).forEach(bet => {
                    console.log(`${bet.user.username} bet ${bet.bet_amount} on ${bet.bet_info.display}`);
                });
                break;
                
            case 'result_published':
                console.log('\n=== Result Published ===');
                console.log('Period ID:', message.data.period_id);
                console.log('Result:', message.data.result);
                console.log('Timestamp:', message.data.timestamp);
                break;
                
            case 'period_reset':
                console.log('\n=== Period Reset ===');
                console.log(message.data.message);
                console.log('Timestamp:', message.data.timestamp);
                break;
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
});

// Handle connection events
ws.on('open', () => {
    console.log('Connected to WebSocket server');
    // Subscribe to 1-minute timeline
    subscribeToTimeline('1min');
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

ws.on('close', () => {
    console.log('Disconnected from WebSocket server');
});

// Keep the process running
process.on('SIGINT', () => {
    ws.close();
    process.exit();
}); 