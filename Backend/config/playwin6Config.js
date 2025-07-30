// config/playwin6Config.js - PlayWin6 Provider Configuration
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const playwin6Config = {
  // API Configuration
  apiBaseUrl: process.env.PLAYWIN6_API_BASE_URL || 'https://playwin6.com',
  
  // Authentication
  apiToken: process.env.PLAYWIN6_API_TOKEN?.trim(),
  
  // Game Launch Configuration
  gameLaunchUrl: process.env.PLAYWIN6_GAME_LAUNCH_URL || 'https://playwin6.com/launchGame',
  providerGameUrl: process.env.PLAYWIN6_PROVIDER_GAME_URL || 'https://playwin6.com/providerGame',
  getProviderUrl: process.env.PLAYWIN6_GET_PROVIDER_URL || 'https://playwin6.com/getProvider',
  
  // Callback URLs
  callbackUrl: process.env.PLAYWIN6_CALLBACK_URL || 
    (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/playwin6/callback` : 'http://localhost:8000/api/playwin6/callback'),
  
  // Frontend URLs
  homeUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cashierUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/wallet` : 'http://localhost:3000/wallet',
  
  // Default Settings
  defaultCurrency: 'INR',
  defaultLanguage: 'en',
  defaultCount: 12,
  
  // Security Configuration
  allowedIPs: process.env.PLAYWIN6_ALLOWED_IPS ? 
    process.env.PLAYWIN6_ALLOWED_IPS.split(',').map(ip => ip.trim()) : [],
  
  // Session Configuration
  sessionExpiry: 3600, // 1 hour in seconds
  playerPrefix: 'player',
  passwordSalt: process.env.PLAYWIN6_PASSWORD_SALT || 'playwin6_salt',
  
  // Game Types
  supportedGameTypes: [
    'Slot Game',
    'Live Casino',
    'Table Games',
    'Card Games',
    'Arcade Games',
    'Fishing Games',
    'Lottery Games',
    'Sports Betting'
  ],
  
  // Providers
  supportedProviders: [
    'JiliGaming',
    'PragmaticPlay',
    'EvolutionGaming',
    'Microgaming',
    'NetEnt',
    'Playtech',
    'Betsoft',
    'Habanero',
    'RedTiger',
    'Quickspin',
    'Yggdrasil',
    'PlayStar',
    'CQ9',
    'PGSoft',
    'SpadeGaming',
    'AsiaGaming',
    'BoomingGames',
    'GameArt',
    'Playson',
    'Wazdan'
  ],
  
  // AES Encryption Configuration
  aesKey: process.env.PLAYWIN6_AES_KEY?.trim(),
  aesIv: process.env.PLAYWIN6_AES_IV?.trim(),
  
  // Request Configuration
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  
  // Environment Detection
  isProduction: process.env.NODE_ENV === 'production',
  isStaging: process.env.NODE_ENV === 'staging',
  isDevelopment: process.env.NODE_ENV === 'development'
};

// Configuration validation
const validateConfig = () => {
  const required = ['apiToken'];
  const missing = required.filter(key => !playwin6Config[key] || playwin6Config[key].includes('your_'));
  
  if (missing.length > 0) {
    console.warn('⚠️ PLAYWIN6 CONFIG WARNING: Missing required configuration values:', missing);
    console.warn('⚠️ Please set these environment variables:');
    missing.forEach(key => {
      console.warn(`   - PLAYWIN6_${key.toUpperCase()}`);
    });
  }
  
  // Validate callback URL format if it exists
  if (playwin6Config.callbackUrl) {
    if (playwin6Config.callbackUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      console.warn('⚠️ PLAYWIN6 CONFIG WARNING: Using localhost callback URL in production');
    }
  }
  
  // Validate AES configuration
  if (!playwin6Config.aesKey || !playwin6Config.aesIv) {
    console.warn('⚠️ PLAYWIN6 CONFIG WARNING: AES encryption key or IV not configured');
    console.warn('⚠️ Please set PLAYWIN6_AES_KEY and PLAYWIN6_AES_IV environment variables');
  }
  
  return playwin6Config;
};

// Export validated config
module.exports = validateConfig(); 