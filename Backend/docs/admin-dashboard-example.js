// Admin Dashboard Example for Wingo Game Monitoring
const WebSocket = require('ws');
const axios = require('axios');

class WingoAdminDashboard {
    constructor(serverUrl, adminToken) {
        this.serverUrl = serverUrl;
        this.adminToken = adminToken;
        this.ws = null;
        this.currentTimeline = '1min';
        this.currentPeriod = null;
    }

    // Initialize WebSocket connection
    async initialize() {
        try {
            // First, get all active periods
            const activePeriods = await this.getActivePeriods();
            console.log('\n=== Active Periods ===');
            activePeriods.forEach(period => {
                console.log(`${period.timeline}: ${period.period_id} (${period.time_remaining}s remaining)`);
            });

            // Connect to WebSocket
            this.ws = new WebSocket(this.serverUrl.replace('http', 'ws'));
            
            this.ws.on('open', () => {
                console.log('\nConnected to WebSocket server');
                this.subscribeToTimeline(this.currentTimeline);
            });

            this.ws.on('message', (data) => this.handleWebSocketMessage(data));
            
            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

            this.ws.on('close', () => {
                console.log('Disconnected from WebSocket server');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.initialize(), 5000);
            });

        } catch (error) {
            console.error('Error initializing dashboard:', error);
        }
    }

    // Get all active periods
    async getActivePeriods() {
        try {
            const response = await axios.get(`${this.serverUrl}/api/admin/games/wingo/active-periods`, {
                headers: { 'Authorization': `Bearer ${this.adminToken}` }
            });
            return response.data.data.active_periods;
        } catch (error) {
            console.error('Error fetching active periods:', error);
            return [];
        }
    }

    // Subscribe to a specific timeline
    subscribeToTimeline(timeline) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.currentTimeline = timeline;
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                timeline: timeline
            }));
            console.log(`\nSubscribed to ${timeline} timeline`);
        }
    }

    // Handle incoming WebSocket messages
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch(message.type) {
                case 'period_update':
                    this.handlePeriodUpdate(message.data);
                    break;
                case 'result_published':
                    this.handleResultPublished(message.data);
                    break;
                case 'period_reset':
                    this.handlePeriodReset(message.data);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    }

    // Handle period updates
    handlePeriodUpdate(data) {
        this.currentPeriod = data.period;
        console.clear(); // Clear console for better visibility
        
        console.log('\n=== Live Wingo Game Monitor ===');
        console.log(`Timeline: ${data.timeline}`);
        console.log(`Period ID: ${data.period.period_id}`);
        console.log(`Time Remaining: ${data.period.time_remaining} seconds`);
        console.log(`Total Bet Amount: ₹${data.period.total_bet_amount.toFixed(2)}`);
        console.log(`Unique Bettors: ${data.period.unique_bettors}`);

        // Display betting statistics
        this.displayBettingStats(data.period.betting_stats);
        
        // Display recent bets
        this.displayRecentBets(data.period.bets);
    }

    // Display betting statistics
    displayBettingStats(stats) {
        console.log('\n=== Betting Statistics ===');
        
        // Numbers
        console.log('\nNumbers:');
        stats.numbers.forEach(stat => {
            if (stat.total_amount > 0) {
                console.log(`Number ${stat.number}: ₹${stat.total_amount.toFixed(2)} (${stat.bet_count} bets)`);
            }
        });
        
        // Colors
        console.log('\nColors:');
        stats.colors.forEach(stat => {
            if (stat.total_amount > 0) {
                console.log(`${stat.color.toUpperCase()}: ₹${stat.total_amount.toFixed(2)} (${stat.bet_count} bets)`);
            }
        });
        
        // Odd/Even
        console.log('\nOdd/Even:');
        stats.odd_even.forEach(stat => {
            if (stat.total_amount > 0) {
                console.log(`${stat.type.toUpperCase()}: ₹${stat.total_amount.toFixed(2)} (${stat.bet_count} bets)`);
            }
        });
        
        // Size
        console.log('\nSize:');
        stats.size.forEach(stat => {
            if (stat.total_amount > 0) {
                console.log(`${stat.size.toUpperCase()}: ₹${stat.total_amount.toFixed(2)} (${stat.bet_count} bets)`);
            }
        });
    }

    // Display recent bets
    displayRecentBets(bets) {
        console.log('\n=== Recent Bets ===');
        bets.slice(-5).forEach(bet => {
            console.log(`${bet.user.username} bet ₹${bet.bet_amount.toFixed(2)} on ${bet.bet_info.display}`);
        });
    }

    // Handle result published
    handleResultPublished(data) {
        console.log('\n=== Result Published ===');
        console.log('Period ID:', data.period_id);
        console.log('Result:', data.result);
        console.log('Timestamp:', data.timestamp);
    }

    // Handle period reset
    handlePeriodReset(data) {
        console.log('\n=== Period Reset ===');
        console.log(data.message);
        console.log('Timestamp:', data.timestamp);
    }
}

// Usage example
const dashboard = new WingoAdminDashboard(
    'http://localhost:8000',
    'your-admin-token'
);

dashboard.initialize();

// Handle process termination
process.on('SIGINT', () => {
    if (dashboard.ws) {
        dashboard.ws.close();
    }
    process.exit();
}); 