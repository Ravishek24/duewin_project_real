// config/spribeConfig.js - FIXED CONFIGURATION

require('dotenv').config();

const config = {
  // API Configuration
  apiBaseUrl: process.env.SPRIBE_API_BASE_URL || 'https://dev-test.spribe.io/api',
  gameLaunchUrl: process.env.SPRIBE_GAME_LAUNCH_URL || 'https://dev-test.spribe.io/games/launch',
  returnUrl: process.env.SPRIBE_RETURN_URL || 'https://strike.atsproduct.in/games',
  accountHistoryUrl: process.env.SPRIBE_ACCOUNT_HISTORY_URL || 'https://strike.atsproduct.in/account/history',
  
  // Client Configuration
  clientId: process.env.SPRIBE_CLIENT_ID,
  clientSecret: process.env.SPRIBE_CLIENT_SECRET,
  
  // 🔥 FIXED: Updated game configuration to match SPRIBE's actual game IDs
  availableGames: [
    'aviator',        // ✅ This is the correct ID for Aviator
    'dice',           // ✅ Dice game
    'goal',           // ✅ Goal game  
    'plinko',         // ✅ Plinko game
    'mines',          // ✅ Mines game
    'hi-lo',          // ✅ Hi-Lo game (note the hyphen)
    'keno',           // ✅ Keno game
    'mini-roulette',  // ✅ Mini Roulette (note the hyphen)
    'hotline',        // ✅ Hotline game
    'balloon'         // ✅ Balloon game
  ],
  
  // 🔥 FIXED: Updated providers to match SPRIBE documentation
  providers: {
    'aviator': 'spribe_aviator',     // ✅ Aviator has its own provider
    'dice': 'spribe_crypto',         // ✅ Crypto games
    'goal': 'spribe_crypto',         // ✅ Crypto games
    'plinko': 'spribe_crypto',       // ✅ Crypto games
    'mines': 'spribe_crypto',        // ✅ Crypto games
    'hi-lo': 'spribe_crypto',        // ✅ Crypto games (note hyphen)
    'keno': 'spribe_crypto',         // ✅ Crypto games
    'mini-roulette': 'spribe_crypto', // ✅ Crypto games (note hyphen)
    'hotline': 'spribe_crypto',      // ✅ Crypto games
    'balloon': 'spribe_crypto'       // ✅ Crypto games
  },
  
  // Currency Configuration
  supportedCurrencies: ['USD'], // 🔥 FIXED: Only USD for now
  defaultCurrency: 'USD',
  
  // Security Configuration
  allowedIps: process.env.SPRIBE_ALLOWED_IPS ? process.env.SPRIBE_ALLOWED_IPS.split(',') : [],
  tokenExpiry: 4 * 60 * 60, // 4 hours in seconds
  
  // 🔥 ADDED: Game info URL for thumbnails
  gameInfoUrl: process.env.SPRIBE_GAME_INFO_URL || 'https://cdn.spribe.io',
  
  // Logging Configuration
  enableDetailedLogging: true,
  
  // 🔥 UPDATED: Separate callback URLs for each action type as required by SPRIBE
  callbackUrls: {
    auth: 'https://strike.atsproduct.in/api/spribe/auth',
    info: 'https://strike.atsproduct.in/api/spribe/info',
    withdraw: 'https://strike.atsproduct.in/api/spribe/withdraw',
    deposit: 'https://strike.atsproduct.in/api/spribe/deposit',
    rollback: 'https://strike.atsproduct.in/api/spribe/rollback'
  },
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
  returnUrl: config.returnUrl,
  accountHistoryUrl: config.accountHistoryUrl,
  availableGames: config.availableGames,
  supportedCurrencies: config.supportedCurrencies,
  defaultCurrency: config.defaultCurrency,
  tokenExpiry: config.tokenExpiry,
  enableDetailedLogging: config.enableDetailedLogging,
  gameCount: config.availableGames.length
});

module.exports = config;