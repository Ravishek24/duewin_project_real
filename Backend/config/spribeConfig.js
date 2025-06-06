// config/spribeConfig.js
require('dotenv').config();

const config = {
  // API Configuration
  apiBaseUrl: process.env.SPRIBE_API_BASE_URL || 'https://dev-test.spribe.io/api',
  gameLaunchUrl: process.env.SPRIBE_GAME_LAUNCH_URL || 'https://dev-test.spribe.io/games/launch',
  callbackUrl: process.env.SPRIBE_CALLBACK_URL || 'https://strike.atsproduct.in/api/spribe/callback',
  returnUrl: process.env.SPRIBE_RETURN_URL || 'https://strike.atsproduct.in/games',
  accountHistoryUrl: process.env.SPRIBE_ACCOUNT_HISTORY_URL || 'https://strike.atsproduct.in/account/history',
  
  // Client Configuration
  clientId: process.env.SPRIBE_CLIENT_ID,
  clientSecret: process.env.SPRIBE_CLIENT_SECRET,
  
  // Game Configuration
  availableGames: ['goal', 'crash', 'dice', 'plinko', 'mines', 'tower'],
  providers: {
    goal: 'spribe_crypto',
    crash: 'spribe_crypto',
    dice: 'spribe_crypto',
    plinko: 'spribe_crypto',
    mines: 'spribe_crypto',
    tower: 'spribe_crypto'
  },
  
  // Currency Configuration
  supportedCurrencies: ['USD', 'EUR'],
  defaultCurrency: 'USD',
  
  // Security Configuration
  allowedIps: process.env.SPRIBE_ALLOWED_IPS ? process.env.SPRIBE_ALLOWED_IPS.split(',') : [],
  tokenExpiry: 4 * 60 * 60, // 4 hours in seconds
  
  // Logging Configuration
  enableDetailedLogging: true
};

// Validate required fields
if (!config.clientId || !config.clientSecret) {
  console.error('❌ SPRIBE configuration error: Missing required fields');
  console.error('Required fields:', {
    clientId: !!config.clientId,
    clientSecret: !!config.clientSecret
  });
  throw new Error('Missing required SPRIBE configuration fields');
}

// Log configuration (excluding sensitive data)
console.log('📋 SPRIBE Configuration:', {
  apiBaseUrl: config.apiBaseUrl,
  gameLaunchUrl: config.gameLaunchUrl,
  callbackUrl: config.callbackUrl,
  returnUrl: config.returnUrl,
  accountHistoryUrl: config.accountHistoryUrl,
  availableGames: config.availableGames,
  supportedCurrencies: config.supportedCurrencies,
  defaultCurrency: config.defaultCurrency,
  tokenExpiry: config.tokenExpiry,
  enableDetailedLogging: config.enableDetailedLogging
});

module.exports = config;