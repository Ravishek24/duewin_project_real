// config/spribeConfig.js - UPDATED FOR STAGING
const dotenv = require('dotenv');

dotenv.config();

const spribeConfig = {
  // STAGING API endpoints (from your provider)
  apiBaseUrl: process.env.SPRIBE_API_URL || 'https://secure-ga.staging.spribe.io/v3',
  launchUrl: process.env.SPRIBE_LAUNCH_URL || 'https://dev-test.spribe.io/games/launch',
  gameInfoUrl: process.env.SPRIBE_GAME_INFO_URL || 'https://games-info.staging.spribe.dev',
  demoUrl: process.env.SPRIBE_DEMO_URL || 'https://demo.spribe.io/launch',
  
  // Authentication credentials (from your provider)
  clientId: process.env.SPRIBE_CLIENT_ID, // You need to get this
  clientSecret: process.env.SPRIBE_CLIENT_SECRET || '4zN47mqNcLqKo6XvHetOVVPEByX52ILQ', // secret_token from provider
  operatorKey: process.env.SPRIBE_OPERATOR_KEY || 'strike', // operator_key from provider
  
  // Callback URL - This is the URL that Spribe will call for all operations
  callbackUrl: process.env.SPRIBE_CALLBACK_URL || 'https://strike.atsproduct.in/api/spribe/callback',
  
  // Default settings - CURRENCY ISSUE FOUND
  defaultLanguage: 'en',
  defaultCurrency: 'USD', // CHANGED from INR to EUR as per your requirement
  
  // Supported currencies (from your provider)
  supportedCurrencies: ['USD', 'INR', 'EUR'], // Added EUR
  
  // Available games in staging (from your provider)
  availableGames: [
    'aviator', 'balloon', 'dice', 'goal', 'hi-lo', 
    'hotline', 'keno', 'mines', 'mini-roulette', 
    'multikeno', 'plinko', 'starline', 'trader'
  ],
  
  // Game providers - UPDATED with correct games from staging
  providers: {
    aviator: 'spribe_aviator',
    balloon: 'spribe_crypto',
    dice: 'spribe_crypto',
    goal: 'spribe_crypto',
    'hi-lo': 'spribe_crypto',
    hotline: 'spribe_crypto',
    keno: 'spribe_crypto',
    mines: 'spribe_crypto',
    'mini-roulette': 'spribe_crypto',
    multikeno: 'spribe_keno', // This is 'multikeno' not 'keno 80'
    plinko: 'spribe_crypto',
    starline: 'spribe_crypto', // NEW game in staging
    trader: 'spribe_trader'
    // REMOVED games not available in staging:
    // 'crystal-fall', 'neo-vegas', 'gates-of-egypt'
  },
  
  // Staging IPs for security (from your provider)
  allowedIPs: [
    '194.36.47.153', '194.36.47.152', '194.36.47.150',
    '3.255.67.141', '52.30.236.39', '54.78.240.177'
  ],
  
  // Time in seconds before a signature expires
  signatureExpirationTime: 300 // 5 minutes
};

module.exports = spribeConfig;