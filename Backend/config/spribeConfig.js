// config/spriteConfig.js
import dotenv from 'dotenv';

dotenv.config();

// config/spribeConfig.js (renamed from spriteConfig.js)
export const spribeConfig = {  // Changed from spriteConfig
  // API endpoints
  apiBaseUrl: process.env.SPRIBE_API_URL || 'https://api.spribe.io',  // Changed from SPRITE_API_URL
  launchUrl: process.env.SPRIBE_LAUNCH_URL || 'https://play.spribe.io',  // Changed from SPRITE_LAUNCH_URL
  
  // Authentication credentials
  clientId: process.env.SPRIBE_CLIENT_ID,  // Changed from SPRITE_CLIENT_ID
  clientSecret: process.env.SPRIBE_CLIENT_SECRET,  // Changed from SPRITE_CLIENT_SECRET
  operatorKey: process.env.SPRIBE_OPERATOR_KEY,  // Changed from SPRITE_OPERATOR_KEY
  
  // Rest of config remains the same

  
  // Default settings
  defaultLanguage: 'en',
  defaultCurrency: 'INR',
  
  // Game providers
  providers: {
    aviator: 'spribe_aviator',
    dice: 'spribe_crypto',
    goal: 'spribe_crypto',
    plinko: 'spribe_crypto',
    mines: 'spribe_crypto',
    'hi-lo': 'spribe_crypto',
    keno: 'spribe_crypto',
    'mini-roulette': 'spribe_crypto',
    hotline: 'spribe_crypto',
    balloon: 'spribe_crypto',
    multikeno: 'spribe_keno',
    trader: 'spribe_trader',
    'crystal-fall': 'spribe_slots',
    'neo-vegas': 'spribe_slots',
    'gates-of-egypt': 'spribe_slots'
  },
  
  // Time in seconds before a signature expires
  signatureExpirationTime: 300 // 5 minutes
};

export default spribeConfig;