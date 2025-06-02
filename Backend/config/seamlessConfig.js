// config/seamlessConfig.js - FIXED VERSION
const dotenv = require('dotenv');

dotenv.config();

const seamlessConfig = {
  api_login: process.env.SEAMLESS_API_LOGIN?.trim(),
  api_password: process.env.SEAMLESS_API_PASSWORD?.trim(),
  salt_key: process.env.SEAMLESS_SALT_KEY?.trim(),
  api_url: {
    staging: 'https://stage.game-program.com/api/seamless/provider',
    production: process.env.SEAMLESS_API_URL?.trim() || 'https://stage.game-program.com/api/seamless/provider'
  },
  callback_url: process.env.SEAMLESS_CALLBACK_URL || 
    (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/seamless/callback` : 'http://localhost:8000/api/seamless/callback'),
  home_url: process.env.FRONTEND_URL || 'http://localhost:3000',
  cashier_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/wallet` : 'http://localhost:3000/wallet',
  default_currency: 'EUR',
  default_language: 'en',
  default_betlevel: 'min',
  session_expiry: 3600, // 1 hour in seconds
  player_prefix: 'player',
  password_salt: process.env.SEAMLESS_PASSWORD_SALT || 'default_salt'
};


// ADDED: Configuration validation
const validateConfig = () => {
  const required = ['api_login', 'api_password', 'salt_key'];
  const missing = required.filter(key => !seamlessConfig[key] || seamlessConfig[key].includes('your_'));
  
  if (missing.length > 0) {
    console.warn('⚠️ SEAMLESS CONFIG WARNING: Missing required configuration values:', missing);
    console.warn('⚠️ Please set these environment variables:');
    missing.forEach(key => {
      console.warn(`   - SEAMLESS_${key.toUpperCase()}`);
    });
  }
  
  // Validate callback URL format if it exists
  if (seamlessConfig.callback_url) {
    if (seamlessConfig.callback_url.includes('localhost') && process.env.NODE_ENV === 'production') {
      console.warn('⚠️ SEAMLESS CONFIG WARNING: Using localhost callback URL in production');
    }
    
    // Check for Cloudflare warning
    if (seamlessConfig.callback_url.includes('cloudflare') || seamlessConfig.callback_url.includes('cf-')) {
      console.warn('⚠️ SEAMLESS CONFIG WARNING: Callback URL appears to be behind Cloudflare - this may cause issues');
    }
  }
  
  return seamlessConfig;
};

// Export validated config
module.exports = validateConfig();