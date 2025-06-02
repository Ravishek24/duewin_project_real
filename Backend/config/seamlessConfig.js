// config/seamlessConfig.js - FIXED VERSION
const dotenv = require('dotenv');

dotenv.config();

const seamlessConfig = {
  // API Credentials (should be stored in environment variables)
  api_login: process.env.SEAMLESS_API_LOGIN || 'flywin_mc_s',
  api_password: process.env.SEAMLESS_API_PASSWORD || 'NbRWpbhtEVf8wIYW5G',
  
  // Salt key for request validation (CRITICAL - must be provided by your game provider)
  salt_key: process.env.SEAMLESS_SALT_KEY || 'your_salt_key_from_provider',
  
  // API URLs
  api_url: {
    staging: 'https://stage.game-program.com/api/seamless/provider',
    production: process.env.NODE_ENV === 'production' 
      ? (process.env.SEAMLESS_API_URL || 'https://stage.game-program.com/api/seamless/provider')
      : 'https://stage.game-program.com/api/seamless/provider'
  },
  
  // Default language
  default_language: 'en',
  
  // Default currency
  default_currency: 'EUR',
  
  // Default URLs - these must be accessible from the game provider
  home_url: process.env.FRONTEND_URL || 'http://localhost:3000',
  cashier_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/wallet` : 'http://localhost:3000/wallet',
  
  // Callback URL (unified endpoint for all transaction types)
  // IMPORTANT: This URL must be accessible from the game provider and NOT behind Cloudflare
  callback_url: process.env.SEAMLESS_CALLBACK_URL || 
    (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/seamless/callback` : 'http://localhost:8000/api/seamless/callback'),
  
  // Free rounds settings
  default_betlevel: 'min',
  
  // Session expiration time in seconds (24 hours)
  session_expiry: 86400,
  
  // Callback timeout (in milliseconds)
  callback_timeout: 10000,
  
  // ADDED: Player management settings for consistent authentication
  player_prefix: 'player', // Consistent prefix for all players
  password_salt: process.env.SEAMLESS_PASSWORD_SALT || 'duewin_seamless_2024',
  
  // ADDED: Request timeout settings
  request_timeout: 30000, // 30 seconds for API requests
  
  // ADDED: Provider specific settings based on documentation
  provider_settings: {
    // IP whitelist requirement mentioned in docs
    requires_ip_whitelist: true,
    // Cloudflare restriction mentioned in docs  
    no_cloudflare: true,
    // Session duration from docs
    max_session_duration: 86400, // 24 hours
    // Provider expects specific response format
    response_format: 'json',
    // Provider requires specific status codes
    success_status: '200',
    error_status: ['403', '404', '500']
  },
  
  // ADDED: Validation settings
  validation: {
    // Validate signatures on incoming requests
    validate_signatures: true,
    // Allow requests only from whitelisted IPs (if configured)
    check_ip_whitelist: false, // Set to true if you have IP restrictions
    // Log all transactions for debugging
    log_transactions: process.env.NODE_ENV === 'development'
  },
  
  // ADDED: Game session settings
  session_settings: {
    // Maximum number of active sessions per user
    max_sessions_per_user: 3,
    // Cleanup expired sessions interval (in minutes)
    cleanup_interval: 60,
    // Session inactivity timeout (in minutes)
    inactivity_timeout: 30
  },
  
  // ADDED: Error handling settings
  error_handling: {
    // Retry failed requests
    retry_attempts: 3,
    // Retry delay in milliseconds
    retry_delay: 1000,
    // Log errors for debugging
    log_errors: true
  },
  
  // ADDED: Development/Debug settings
  debug: {
    // Enable detailed logging in development
    enabled: process.env.NODE_ENV === 'development',
    // Log API requests and responses
    log_api_calls: process.env.NODE_ENV === 'development',
    // Log wallet transactions
    log_transactions: process.env.NODE_ENV === 'development'
  }
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
  
  // Validate callback URL format
  if (seamlessConfig.callback_url.includes('localhost') && process.env.NODE_ENV === 'production') {
    console.warn('⚠️ SEAMLESS CONFIG WARNING: Using localhost callback URL in production');
  }
  
  // Check for Cloudflare warning
  if (seamlessConfig.callback_url.includes('cloudflare') || seamlessConfig.callback_url.includes('cf-')) {
    console.warn('⚠️ SEAMLESS CONFIG WARNING: Callback URL appears to be behind Cloudflare - this may cause issues');
  }
  
  return seamlessConfig;
};

// Validate configuration on load
module.exports = validateConfig();