const fs = require('fs');
const path = require('path');

console.log('Starting to add betting freeze functionality...');

// Path to the gameLogicService.js file
const filePath = path.join(__dirname, 'services', 'gameLogicService.js');

// Read the file content
console.log(`Reading file: ${filePath}`);
let content = fs.readFileSync(filePath, 'utf8');

// Create a backup
const backupPath = filePath + '.before-freeze';
fs.writeFileSync(backupPath, content);
console.log(`Created backup at: ${backupPath}`);

// Add the isBettingFrozen function before module.exports
const moduleExportsIndex = content.indexOf('module.exports');

// Helper functions to add
const helperFunctions = `
/**
 * Check if betting is frozen for the current period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {boolean} - Whether betting is frozen
 */
const isBettingFrozen = async (gameType, duration, periodId) => {
    try {
        // Get period end time
        const endTime = calculatePeriodEndTime(periodId, duration);
        const now = new Date();
        
        // Calculate time remaining in seconds
        const timeRemaining = Math.max(0, (endTime - now) / 1000);
        
        // Betting is frozen in the last 5 seconds
        return timeRemaining <= 5;
    } catch (error) {
        logger.error('Error checking if betting is frozen', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        
        // Default to frozen in case of error
        return true;
    }
};

/**
 * Check if there are any bets for the current period
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {boolean} - Whether there are any bets
 */
const hasBets = async (gameType, duration, periodId) => {
    try {
        // Get duration key for Redis
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Create Redis key for bets
        const betsKey = \`\${gameType}:\${durationKey}:\${periodId}:bets\`;
        
        // Get bets from Redis
        const betsStr = await redisClient.get(betsKey);
        
        if (!betsStr) {
            return false;
        }
        
        const bets = JSON.parse(betsStr);
        
        return bets.length > 0;
    } catch (error) {
        logger.error('Error checking if period has bets', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
        
        return false;
    }
};

/**
 * Update game history in Redis
 * @param {string} gameType - Game type
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Game result
 */
const updateGameHistory = async (gameType, duration, periodId, result) => {
    try {
        // Get duration key for Redis
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Create Redis key for history
        const historyKey = \`\${gameType}:\${durationKey}:history\`;
        
        // Get current history
        let history = await redisClient.get(historyKey);
        
        if (!history) {
            history = '[]';
        }
        
        const historyData = JSON.parse(history);
        
        // Add new result to history
        const historyItem = {
            periodId,
            result,
            timestamp: new Date().toISOString()
        };
        
        // Add to the beginning of the array
        historyData.unshift(historyItem);
        
        // Limit to 100 items
        if (historyData.length > 100) {
            historyData.pop();
        }
        
        // Save updated history
        await redisClient.set(historyKey, JSON.stringify(historyData), 'EX', 86400); // Expire after 24 hours
    } catch (error) {
        logger.error('Error updating game history', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            periodId
        });
    }
};

`;

// Insert the helper functions before module.exports
if (moduleExportsIndex !== -1) {
  content = content.substring(0, moduleExportsIndex) + helperFunctions + content.substring(moduleExportsIndex);
  console.log('Added helper functions before module.exports');
}

// Find the processBet function to update it
const processBetIndex = content.indexOf('const processBet = async (betData) => {');

if (processBetIndex !== -1) {
  // Find where to insert the betting freeze check
  const dataDestructuringEnd = content.indexOf('} = betData;', processBetIndex);
  
  if (dataDestructuringEnd !== -1) {
    // Code to insert after the destructuring
    const freezeCheck = `
        
        // Check if betting is frozen for this period
        const frozen = await isBettingFrozen(gameType, duration, periodId);
        
        if (frozen) {
            return {
                success: false,
                message: 'Betting is frozen for this period'
            };
        }
`;
    
    // Insert the freeze check
    content = content.substring(0, dataDestructuringEnd + 11) + freezeCheck + content.substring(dataDestructuringEnd + 11);
    console.log('Added betting freeze check to processBet function');
  }
}

// Update module.exports to include our new functions
const moduleExportsStart = content.indexOf('module.exports = {');
if (moduleExportsStart !== -1) {
  // Find the closing brace of module.exports
  const moduleExportsEnd = content.indexOf('};', moduleExportsStart);
  if (moduleExportsEnd !== -1) {
    // Check if our functions are already exported
    const exportSection = content.substring(moduleExportsStart, moduleExportsEnd);
    if (!exportSection.includes('isBettingFrozen')) {
      // Add our functions to exports
      const newExports = ',\n  isBettingFrozen,\n  hasBets,\n  updateGameHistory';
      content = content.substring(0, moduleExportsEnd) + newExports + content.substring(moduleExportsEnd);
      console.log('Added new functions to module.exports');
    }
  }
}

// Write the modified content back to the file
fs.writeFileSync(filePath, content);
console.log('Successfully updated file with betting freeze functionality');

console.log('Done! Please restart your server to apply the changes.'); 