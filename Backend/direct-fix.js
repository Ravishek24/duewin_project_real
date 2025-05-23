const fs = require('fs');
const path = require('path');

console.log('Starting direct fix for gameLogicService.js...');

// Path to the gameLogicService.js file
const filePath = path.join(__dirname, 'services', 'gameLogicService.js');

// Read the file content
console.log(`Reading file: ${filePath}`);
let content = fs.readFileSync(filePath, 'utf8');

// Create a backup of the original file
const backupPath = filePath + '.original';
fs.writeFileSync(backupPath, content);
console.log(`Created backup at: ${backupPath}`);

// Extract the module.exports section
const exportPattern = /module\.exports\s*=\s*\{[\s\S]*?\};/m;
const exportMatch = content.match(exportPattern);
let exportsSection = '';

if (exportMatch) {
  exportsSection = exportMatch[0];
  console.log('Successfully extracted exports section');
} else {
  console.log('Could not find exports section, will create a new one');
}

// Remove any duplicate processGameResults functions
console.log('Looking for processGameResults declarations...');
const processGamePattern = /\/\*\*[\s\S]*?Process game results for a period[\s\S]*?const processGameResults[\s\S]*?};/g;
const matches = content.match(processGamePattern);

if (matches && matches.length > 0) {
  console.log(`Found ${matches.length} processGameResults declarations`);
  
  // Keep only the first implementation and remove others
  if (matches.length > 1) {
    for (let i = 1; i < matches.length; i++) {
      content = content.replace(matches[i], '');
    }
    console.log(`Removed ${matches.length - 1} duplicate declarations`);
  }
} else {
  console.log('No processGameResults declarations found, which is unexpected');
}

// Add our new helper functions before module.exports
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

// Find processBet function and update it to check for betting freeze
const processBetPattern = /const processBet = async \(betData\) => \{[\s\S]*?try \{[\s\S]*?const \{[\s\S]*?betAmount[\s\S]*?\} = betData;/;
const processBetMatch = content.match(processBetPattern);

if (processBetMatch) {
  console.log('Found processBet function, adding betting freeze check');
  
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
  
  const processBetString = processBetMatch[0];
  const updatedProcessBet = processBetString + freezeCheck;
  
  content = content.replace(processBetString, updatedProcessBet);
  console.log('Added betting freeze check to processBet function');
} else {
  console.log('Could not find processBet function to update');
}

// Replace module.exports to include our new functions
if (exportMatch) {
  const newExports = exportsSection.replace('module.exports = {', 'module.exports = {\n  isBettingFrozen,\n  hasBets,\n  updateGameHistory,');
  content = content.replace(exportsSection, newExports);
  console.log('Updated module.exports to include new functions');
}

// Insert helper functions before module.exports
const moduleExportsIndex = content.indexOf('module.exports = {');
if (moduleExportsIndex !== -1) {
  content = content.substring(0, moduleExportsIndex) + helperFunctions + content.substring(moduleExportsIndex);
  console.log('Added helper functions before module.exports');
}

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);
console.log('Successfully updated gameLogicService.js');

console.log('Done! Please restart your server to apply the changes.'); 