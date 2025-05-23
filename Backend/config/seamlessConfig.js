// config/seamlessConfig.js
const dotenv = require('dotenv');

dotenv.config();

const seamlessConfig = {
  // API Credentials (should be stored in environment variables)
  api_login: process.env.SEAMLESS_API_LOGIN || 'your_api_login',
  api_password: process.env.SEAMLESS_API_PASSWORD || 'your_api_password',
  
  // Salt key for request validation
  salt_key: process.env.SEAMLESS_SALT_KEY || 'your_salt_key',
  
  // API URLs
  api_url: {
    staging: 'https://stage.game-program.com/api/seamless/provider',
    production: process.env.NODE_ENV === 'production' 
      ? process.env.SEAMLESS_API_URL 
      : 'https://stage.game-program.com/api/seamless/provider'
  },
  
  // Default language
  default_language: 'en',
  
  // Default currency
  default_currency: 'EUR',
  
  // Default URLs
  home_url: process.env.FRONTEND_URL || 'http://localhost:3000',
  cashier_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/wallet` : 'http://localhost:3000/wallet',
  
  // Callback URL (unified endpoint for all transaction types)
  callback_url: process.env.SEAMLESS_CALLBACK_URL || 'https://yourdomain.com/api/seamless/callback',
  
  // Free rounds settings
  default_betlevel: 'min',
  
  // Session expiration time in seconds (24 hours)
  session_expiry: 86400,
  
  // Callback timeout (in milliseconds)
  callback_timeout: 10000
};

module.exports = seamlessConfig;