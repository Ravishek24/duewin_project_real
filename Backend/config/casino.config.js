require('dotenv').config();

const casinoConfig = {
  // API Credentials
  agency_uid: process.env.CASINO_AGENCY_UID || '8dee1e401b87408cca3ca813c2250cb4',
  aes_key: process.env.CASINO_AES_KEY || '68b074393ec7c5a975856a90bd6fdf47',
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
  
  // Default Settings
  default_currency: 'INR',
  default_language: 'en',
  default_platform: 'web',
  
  // Callback URLs
  callback_url: process.env.CASINO_CALLBACK_URL || 
    (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/casino/callback` : 'http://localhost:8000/api/casino/callback'),
  
  home_url: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Security Settings
  timestamp_tolerance: 5 * 60 * 1000, // 5 minutes in milliseconds
  
  // Game Settings
  supported_currencies: ['INR', 'USD', 'EUR'],
  supported_languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
  
  // Session Settings
  session_timeout: 30 * 60 * 1000, // 30 minutes
  
  // Logging
  enable_logging: process.env.CASINO_ENABLE_LOGGING === 'true' || true,
  log_level: process.env.CASINO_LOG_LEVEL || 'info'
};

// Validation function
const validateConfig = () => {
  const required = ['agency_uid', 'aes_key', 'server_url'];
  const missing = required.filter(key => !casinoConfig[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required casino configuration: ${missing.join(', ')}`);
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
  
  return true;
};

// Export validated config
module.exports = {
  ...casinoConfig,
  validate: validateConfig
};
