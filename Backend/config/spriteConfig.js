// config/spriteConfig.js
import dotenv from 'dotenv';

dotenv.config();

export const spriteConfig = {
  // API endpoints (would be environment-specific in production)
  apiBaseUrl: process.env.SPRITE_API_URL || 'https://api.sprite.example.com',
  launchUrl: process.env.SPRITE_LAUNCH_URL || 'https://play.sprite.example.com',
  
  // Authentication credentials
  clientId: process.env.SPRITE_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.SPRITE_CLIENT_SECRET || 'your-client-secret',
  operatorKey: process.env.SPRITE_OPERATOR_KEY || 'your-operator-key',
  
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

export default spriteConfig;