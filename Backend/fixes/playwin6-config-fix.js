/**
 * PlayWin6 Configuration Fix
 * This fixes the PlayWin6 API authentication and endpoint issues
 */

const playwin6Config = require('../config/playwin6Config');

/**
 * Enhanced PlayWin6 Configuration with proper API endpoints
 */
const fixedPlaywin6Config = {
  ...playwin6Config,
  
  // FIXED: Correct API endpoints
  apiBaseUrl: process.env.PLAYWIN6_API_BASE_URL || 'https://playwin6.com',
  gameLaunchUrl: process.env.PLAYWIN6_GAME_LAUNCH_URL || 'https://playwin6.com/launchGame',
  providerGameUrl: process.env.PLAYWIN6_PROVIDER_GAME_URL || 'https://playwin6.com/providerGame',
  getProviderUrl: process.env.PLAYWIN6_GET_PROVIDER_URL || 'https://playwin6.com/getProvider',
  
  // FIXED: Authentication
  apiToken: process.env.PLAYWIN6_API_TOKEN?.trim(),
  
  // FIXED: Correct provider names
  supportedProviders: [
    'JiliGaming',      // Most common provider
    'PragmaticPlay',   // Popular provider
    'Evolution',       // Live casino
    'MicroGaming',     // Classic provider
    'NetEnt',          // Popular slots
    'Playtech',        // Established provider
    'Betsoft',         // 3D slots
    'Habanero',        // Asian market
    'RedTiger',        // Modern slots
    'Quickspin',       // Innovative slots
    'Yggdrasil',       // Premium slots
    'PlayStar',        // Asian provider
    'CQ9',             // Asian slots
    'PGSoft',          // Popular in Asia
    'SpadeGaming',     // Asian market
    'AsiaGaming',      // Live casino
    'BoomingGames',    // Modern slots
    'GameArt',         // European provider
    'Playson',         // Established provider
    'Wazdan',          // Modern slots
    'Spribe',          // Crash games
    'AG',              // Asia Gaming
    'Aog',             // AOG Gaming
    'AstarGaming',     // Astar Gaming
    'Bflottobit',      // Bflottobit
    'Bgaming',         // BGaming
    'BtiGaming',       // BTI Gaming
    'DreamGaming',     // Dream Gaming
    'EazyGaming',      // Eazy Gaming
    'Evoplay',         // Evoplay
    'Ezugi',           // Ezugi
    'FaChaiGaming',    // FaChai Gaming
    'iDeal',           // iDeal
    'InOut',           // InOut
    'KM',              // KM Gaming
    'LuckSportGaming', // LuckSport Gaming
    'Mancala',         // Mancala
    'NextSpin',        // NextSpin
    'OnGaming',        // OnGaming
    'PgsGaming',       // PGS Gaming
    'RelexGaming',     // Relex Gaming
    'Rich88',          // Rich88
    'SABA Sports',     // SABA Sports
    'SaGaming',        // SA Gaming
    'Sexy',            // Sexy Gaming
    'SkyWind',         // SkyWind
    'T1',              // T1 Gaming
    'TADAGaming',      // TADA Gaming
    'TFGaming',        // TF Gaming
    'UnitedGaming',    // United Gaming
    'V8',              // V8 Gaming
    'YeeBet'           // YeeBet
  ],
  
  // FIXED: Correct game types
  supportedGameTypes: [
    'Slot Game',
    'Live Casino',
    'Table Games',
    'Card Games',
    'Arcade Games',
    'Fishing Games',
    'Lottery Games',
    'Sports Betting',
    'Crash Game',
    'Dice',
    'Roulette',
    'Poker',
    'Bingo',
    'Scratch cards',
    'Video Slot',
    'CasinoLive',
    'CasinoLive & Slot',
    'Slot Lobby',
    'Casual',
    'Crash',
    'Crash Games',
    'India Poker Game',
    'slot',
    'slot/arcade',
    'card',
    'casino',
    'fish',
    'arcade',
    'arcade games',
    'board games',
    'Gamble Game',
    'Classic Games',
    'Monster Games',
    'Scratch Games',
    'Bingo game',
    'Arcade game',
    'Slot game',
    'Esports',
    'hall',
    'video games',
    'Instant',
    'Lobby',
    'Live Grand',
    'Slots',
    'Video Bingo',
    'Fishing',
    'Aracde',
    'CasinoTable'
  ]
};

/**
 * Validate PlayWin6 configuration
 */
const validatePlayWin6Config = () => {
  const issues = [];
  
  // Check API token
  if (!fixedPlaywin6Config.apiToken) {
    issues.push('PLAYWIN6_API_TOKEN is not configured');
  }
  
  // Check AES encryption
  if (!fixedPlaywin6Config.aesKey) {
    issues.push('PLAYWIN6_AES_KEY is not configured');
  }
  
  if (!fixedPlaywin6Config.aesIv) {
    issues.push('PLAYWIN6_AES_IV is not configured');
  }
  
  // Check URLs
  if (!fixedPlaywin6Config.apiBaseUrl) {
    issues.push('PLAYWIN6_API_BASE_URL is not configured');
  }
  
  if (issues.length > 0) {
    console.error('❌ PlayWin6 Configuration Issues:');
    issues.forEach(issue => console.error(`   - ${issue}`));
    return false;
  }
  
  console.log('✅ PlayWin6 configuration is valid');
  return true;
};

/**
 * Test PlayWin6 API connectivity
 */
const testPlayWin6API = async () => {
  try {
    console.log('🧪 Testing PlayWin6 API connectivity...');
    
    const axios = require('axios');
    
    // Test basic connectivity
    const response = await axios.get(fixedPlaywin6Config.apiBaseUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'PlayWin6-Integration/1.0'
      }
    });
    
    console.log('✅ PlayWin6 API is reachable');
    return true;
    
  } catch (error) {
    console.error('❌ PlayWin6 API connectivity test failed:', error.message);
    return false;
  }
};

/**
 * Get recommended provider for testing
 */
const getRecommendedProvider = () => {
  // Return a provider that's most likely to work
  return 'JiliGaming';
};

/**
 * Get recommended game type for testing
 */
const getRecommendedGameType = () => {
  // Return a game type that's most likely to work
  return 'Slot Game';
};

module.exports = {
  fixedPlaywin6Config,
  validatePlayWin6Config,
  testPlayWin6API,
  getRecommendedProvider,
  getRecommendedGameType
}; 