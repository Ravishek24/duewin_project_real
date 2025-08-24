require('dotenv').config();

const casinoConfig = {
  // API Credentials - CORRECTED
  agency_uid: process.env.CASINO_AGENCY_UID || '3bf0f8fe664844ba7dba29859ba90748', // Use your actual agency_uid from logs
  aes_key: process.env.CASINO_AES_KEY || '68b074393ec7c5a975856a90bd6fdf47',     // Your AES key
  server_url: process.env.CASINO_SERVER_URL || 'https://jsgame.live',
  
  // API Endpoints
  endpoints: {
    game_v1: '/game/v1',           // SEAMLESS game launch
    game_v2: '/game/v2',           // TRANSFER game launch  
    transaction_list: '/game/transaction/list',
    game_list: '/game/list',       // Get available games list
    provider_list: '/game/provider/list',  // Get available providers list
    balance_check: '/game/balance/check',  // Check user balance
    user_info: '/game/user/info'   // Get user information
  },
  
  // Default Settings - CORRECTED to match your wallet
  default_currency: 'EUR', // Changed from INR to EUR to match your wallet
  default_language: 'en',
  default_platform: 'web',
  
  // Callback URLs - Use your actual URLs
  callback_url: process.env.CASINO_CALLBACK_URL || 'https://api.strikecolor1.com/api/casino/callback',
  home_url: process.env.FRONTEND_URL || 'https://duewingame-three.vercel.app',
  
  // Security Settings
  timestamp_tolerance: 5 * 60 * 1000, // 5 minutes in milliseconds
  
  // Game Settings - EXPANDED to include EUR
  supported_currencies: ['EUR', 'USD', 'INR'], // EUR first since your wallet uses EUR
  supported_languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
  
  // Session Settings
  session_timeout: 30 * 60 * 1000, // 30 minutes
  
  // Balance limits to prevent API errors
  max_credit_amount: 1000000, // Cap at 1M to prevent API limits
  min_credit_amount: 1,       // Minimum 1 unit
  
  // Logging
  enable_logging: process.env.CASINO_ENABLE_LOGGING === 'true' || true,
  log_level: process.env.CASINO_LOG_LEVEL || 'info'
};

// Enhanced validation function
const validateConfig = () => {
  const required = ['agency_uid', 'aes_key', 'server_url'];
  const missing = required.filter(key => !casinoConfig[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required casino configuration: ${missing.join(', ')}`);
  }
  
  // Validate agency_uid format (should be 32 character hex string)
  if (!/^[a-f0-9]{32}$/i.test(casinoConfig.agency_uid)) {
    console.warn(`⚠️  Warning: Agency UID should be a 32-character hex string. Current: ${casinoConfig.agency_uid}`);
  }
  
  // Validate AES key length
  const keyBuffer = Buffer.from(casinoConfig.aes_key, 'hex');
  if (keyBuffer.length === 16) {
    console.log('ℹ️  AES key is 16 bytes (128-bit) - using AES-128-ECB');
  } else if (keyBuffer.length === 32) {
    console.log('ℹ️  AES key is 32 bytes (256-bit) - using AES-256-ECB');
  } else {
    console.warn(`⚠️  Warning: AES key is ${keyBuffer.length} bytes - should be 16 (AES-128) or 32 (AES-256) bytes`);
  }
  
  // Validate URLs
  try {
    new URL(casinoConfig.server_url);
    new URL(casinoConfig.callback_url);
    new URL(casinoConfig.home_url);
  } catch (error) {
    console.warn(`⚠️  Warning: Invalid URL in configuration: ${error.message}`);
  }
  
  return true;
};

// Export validated config
module.exports = {
  ...casinoConfig,
  validate: validateConfig
};