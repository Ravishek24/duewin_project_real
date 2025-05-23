// Helper functions for load testing
module.exports = {
    // Generate random bet amount between 10 and 1000
    generateBetAmount: function() {
        return Math.floor(Math.random() * 990) + 10;
    },

    // Generate random game type
    generateGameType: function() {
        const games = ['k3', '5d', 'lucky7'];
        return games[Math.floor(Math.random() * games.length)];
    },

    // Generate random bet type for K3
    generateK3BetType: function() {
        const betTypes = ['big', 'small', 'odd', 'even', 'sum'];
        return betTypes[Math.floor(Math.random() * betTypes.length)];
    },

    // Generate random number for K3
    generateK3Number: function() {
        return Math.floor(Math.random() * 6) + 1;
    },

    // Generate random period for game results
    generatePeriod: function() {
        const date = new Date();
        return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}001`;
    },

    // Generate random bet type
    generateBetType: function(gameType) {
        if (gameType === 'k3') {
            const types = ['big', 'small', 'odd', 'even'];
            return types[Math.floor(Math.random() * types.length)];
        }
        // Add more game-specific bet types here
        return 'big';
    },

    // Generate test user data
    generateTestUser: function() {
        return {
            username: `testuser_${Math.floor(Math.random() * 1000)}`,
            password: 'testpass123'
        };
    },

    // Validate response
    validateResponse: function(response) {
        if (response.statusCode !== 200) {
            console.error(`Error: ${response.statusCode} - ${response.body}`);
        }
    }
}; 