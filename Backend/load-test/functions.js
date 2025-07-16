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
        } else if (gameType === '5d') {
            const types = ['POSITION', 'POSITION_SIZE', 'POSITION_PARITY', 'SUM_SIZE', 'SUM_PARITY'];
            return types[Math.floor(Math.random() * types.length)];
        }
        // Add more game-specific bet types here
        return 'big';
    },

    // Generate random bet value for 5D
    generate5DBetValue: function(betType) {
        const positions = ['A', 'B', 'C', 'D', 'E'];
        const sizes = ['big', 'small'];
        const parities = ['odd', 'even'];
        
        switch (betType) {
            case 'POSITION':
                const position = positions[Math.floor(Math.random() * positions.length)];
                const number = Math.floor(Math.random() * 10); // 0-9
                return `${position}_${number}`;
            case 'POSITION_SIZE':
                const pos = positions[Math.floor(Math.random() * positions.length)];
                const size = sizes[Math.floor(Math.random() * sizes.length)];
                return `${pos}_${size}`;
            case 'POSITION_PARITY':
                const pos2 = positions[Math.floor(Math.random() * positions.length)];
                const parity = parities[Math.floor(Math.random() * parities.length)];
                return `${pos2}_${parity}`;
            case 'SUM_SIZE':
                return sizes[Math.floor(Math.random() * sizes.length)];
            case 'SUM_PARITY':
                return parities[Math.floor(Math.random() * parities.length)];
            default:
                return 'A_5'; // Default fallback
        }
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