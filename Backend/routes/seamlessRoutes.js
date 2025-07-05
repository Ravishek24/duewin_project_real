// routes/seamlessRoutes.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const seamlessController = require('../controllers/seamlessController');
const { auth } = require('../middlewares/authMiddleware');
const { validateSeamlessRequest, logSeamlessRequest } = require('../middlewares/seamlessMiddleware');
const { cacheService } = require('../services/cacheService');
const {
    getSlotsStatsController,
    getLiveCasinoStatsController,
    getSportsBettingStatsController,
    getSeamlessGameHistoryController,
    getAllSeamlessGamesStatsController
} = require('../controllers/seamlessGamesStatsController');

// CRITICAL: Callback test route (should be first)
router.get('/callback-test', (req, res) => {
  console.log('=== CALLBACK TEST HIT ===');
  console.log('Full URL:', req.originalUrl);
  console.log('Base URL:', req.baseUrl);
  console.log('Path:', req.path);
  console.log('Query:', req.query);
  console.log('Headers:', req.headers);
  console.log('IP:', req.ip);
  console.log('Method:', req.method);
  
  res.status(200).json({
    status: '200',
    message: 'Callback endpoint reachable',
    timestamp: new Date().toISOString(),
    url: {
      full: req.originalUrl,
      base: req.baseUrl,
      path: req.path
    },
    query: req.query,
    ip: req.ip,
    method: req.method
  });
});

// Debug route for testing
router.get('/debug', (req, res) => {
  console.log('=== DEBUG ROUTE HIT ===');
  console.log('Request path:', req.path);
  console.log('Request query:', req.query);
  console.log('Request headers:', req.headers);
  res.json({
    success: true,
    message: 'Debug route hit',
    path: req.path,
    query: req.query,
    headers: req.headers,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      SEAMLESS_API_LOGIN: process.env.SEAMLESS_API_LOGIN,
      SEAMLESS_SALT_KEY: process.env.SEAMLESS_SALT_KEY ? 'SET' : 'NOT SET'
    }
  });
});

// Test signature validation
router.get('/test-signature', (req, res) => {
  const { testSignatureValidation } = require('../utils/seamlessUtils');
  const result = testSignatureValidation();
  res.json({
    success: true,
    signatureTest: result,
    message: result ? 'Signature validation working' : 'Signature validation failed'
  });
});

// PROTECTED ROUTES (require authentication)
router.get('/games', auth, seamlessController.getGamesList);
router.post('/games/refresh', auth, seamlessController.refreshGamesList);
router.get('/launch/:gameId', auth, seamlessController.launchGameController);
router.get('/iframe/:gameId', auth, seamlessController.serveGameInIframeController);
router.get('/redirect/:gameId', auth, seamlessController.redirectToGameController);
router.get('/test', auth, seamlessController.testPageController);

// Free rounds routes (admin only)
router.post('/freerounds/add', auth, seamlessController.addFreeRoundsController);
router.post('/freerounds/remove', auth, seamlessController.removeFreeRoundsController);

// CRITICAL: CALLBACK ROUTES (NO AUTH REQUIRED - called by game provider)
// These routes are called by the game provider and should NOT require authentication
// Add logging middleware for debugging
router.use('/callback', logSeamlessRequest);

// Main unified callback route - this is what the provider calls
router.all('/callback', seamlessController.unifiedCallbackController);

// Individual callback routes for backward compatibility (optional)
// router.get('/callback/balance', seamlessController.balanceCallbackController);
// router.get('/callback/debit', seamlessController.debitCallbackController);  
// router.get('/callback/credit', seamlessController.creditCallbackController);
// router.get('/callback/rollback', seamlessController.rollbackCallbackController);
router.post('/callback/unified', seamlessController.unifiedCallbackController);

// Health check route for the callback endpoint
router.get('/callback/health', (req, res) => {
  res.json({
    success: true,
    message: 'Seamless callback endpoint is healthy',
    timestamp: new Date().toISOString(),
    endpoint: req.originalUrl
  });
});

// Debug route to list all available routes
router.get('/debug/routes', (req, res) => {
  const routes = [];
  router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the router
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });

  res.json({
    success: true,
    message: 'Available routes',
    routes: routes,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  });
});

// Cache key and duration for hot games
const HOT_GAMES_CACHE_KEY = 'seamless:hot:games';
const HOT_GAMES_CACHE_DURATION = 7 * 24 * 3600; // 1 week in seconds

// === HOT GAMES ENDPOINT ===
const hotGameIds = [
  "163330", "162656", "159435", "165104", "165102", "165122", "156612", "156980", "157346",
  "163030", "164558", "159200", "169812", "167124", "133151", "114603", "160689", "165040",
  "164150", "170768", "162424", "169658"
];
const hotGameHashes = [
  "spribe_mines", "upgaming_dice", "spribe_dice", "spribe_plinko", "upgaming_plinko",
  "spribe_hilo", "upgaming_hilo", "spribe_keno", "upgaming_keno"
];

router.get('/hot-games', auth, async (req, res) => {
  try {
    // Try to get from cache first
    let cachedHotGames = await cacheService.get(HOT_GAMES_CACHE_KEY);
    
    if (cachedHotGames) {
      console.log('✅ Serving hot games from cache');
      return res.json({
        success: true,
        games: cachedHotGames.games,
        count: cachedHotGames.count,
        fromCache: true,
        cachedAt: cachedHotGames.cachedAt
      });
    }

    // If not in cache, fetch from provider
    console.log('🔄 Fetching hot games from provider');
    const seamlessService = require('../services/seamlessService');
    const result = await seamlessService.getGamesList({ limit: 50000 });
    const allGames = result.games || [];
    const hotGames = allGames.filter(
      game => hotGameIds.includes(game.id) || hotGameHashes.includes(game.id_hash)
    );

    // Prepare cache data
    const cacheData = {
      games: hotGames,
      count: hotGames.length,
      cachedAt: new Date().toISOString()
    };

    // Cache the hot games for 1 week
    await cacheService.set(HOT_GAMES_CACHE_KEY, cacheData, HOT_GAMES_CACHE_DURATION);
    console.log('💾 Hot games cached for 1 week');

    res.json({
      success: true,
      games: hotGames,
      count: hotGames.length,
      fromCache: false,
      cachedAt: cacheData.cachedAt
    });
  } catch (error) {
    console.error('❌ Error in hot-games endpoint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin endpoint to refresh hot games cache
router.post('/hot-games/refresh', auth, async (req, res) => {
  try {
    // Check if user is admin
    const { isAdmin } = require('../middleware/authMiddleware');
    const isUserAdmin = await isAdmin(req.user.user_id);
    
    if (!isUserAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can refresh hot games cache'
      });
    }

    // Clear existing cache
    await cacheService.del(HOT_GAMES_CACHE_KEY);
    console.log('🗑️ Hot games cache cleared');

    // Fetch fresh data
    const seamlessService = require('../services/seamlessService');
    const result = await seamlessService.getGamesList({ limit: 50000 });
    const allGames = result.games || [];
    const hotGames = allGames.filter(
      game => hotGameIds.includes(game.id) || hotGameHashes.includes(game.id_hash)
    );

    // Prepare cache data
    const cacheData = {
      games: hotGames,
      count: hotGames.length,
      cachedAt: new Date().toISOString()
    };

    // Cache the hot games for 1 week
    await cacheService.set(HOT_GAMES_CACHE_KEY, cacheData, HOT_GAMES_CACHE_DURATION);
    console.log('💾 Hot games cache refreshed for 1 week');

    res.json({
      success: true,
      message: 'Hot games cache refreshed successfully',
      games: hotGames,
      count: hotGames.length,
      cachedAt: cacheData.cachedAt
    });
  } catch (error) {
    console.error('❌ Error refreshing hot games cache:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cache status endpoint (admin only)
router.get('/hot-games/cache-status', auth, async (req, res) => {
  try {
    // Check if user is admin
    const { isAdmin } = require('../middleware/authMiddleware');
    const isUserAdmin = await isAdmin(req.user.user_id);
    
    if (!isUserAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can check cache status'
      });
    }

    // Get cache TTL
    const { redis } = require('../config/redisConfig');
    const ttl = await redis.ttl(HOT_GAMES_CACHE_KEY);
    
    // Get cached data
    const cachedData = await cacheService.get(HOT_GAMES_CACHE_KEY);
    
    const status = {
      exists: cachedData !== null,
      ttl: ttl > 0 ? ttl : -1, // -1 means no expiry, -2 means key doesn't exist
      ttlFormatted: ttl > 0 ? `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m ${ttl % 60}s` : 'N/A',
      cachedAt: cachedData?.cachedAt || null,
      gameCount: cachedData?.count || 0,
      cacheDuration: HOT_GAMES_CACHE_DURATION,
      cacheDurationFormatted: '1 week'
    };

    res.json({
      success: true,
      cacheStatus: status
    });
  } catch (error) {
    console.error('❌ Error checking cache status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get slot game history by provider/game type
router.get('/:provider/my-bets', auth, async (req, res) => {
  try {
    const { provider } = req.params;
    const { page = 1, limit = 20, gameId, startDate, endDate, type } = req.query;
    const userId = req.user.user_id;
    
    // Validate provider
    const validProviders = [
      'BombayLive', 'es', 'pf', 'ss', 'ep', 'ag', 'pg', 'ev', 'bp', 'bs', 
      'g24', 'vg', 'ez', 'dt', 'ds', 'ol', 'bl'
    ];
    
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider. Please check the provider list.'
      });
    }
    
    // Build where clause for filtering
    let whereClause = { 
      user_id: userId,
      provider: provider
    };
    
    if (gameId) {
      whereClause.game_id = gameId;
    }
    
    if (type) {
      whereClause.type = type;
    }
    
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at.$gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.created_at.$lte = new Date(endDate);
      }
    }
    
    // Get transactions
    const SeamlessTransaction = require('../models/SeamlessTransaction');
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    const total = await SeamlessTransaction.count({
      where: whereClause
    });
    
    // Get transactions with pagination
    const transactions = await SeamlessTransaction.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });
    
    // Process transactions to calculate profit/loss and format data
    const processedTransactions = transactions.map(transaction => {
      const amount = parseFloat(transaction.amount);
      const isBet = transaction.type === 'debit';
      const isWin = transaction.type === 'credit';
      
      // Calculate profit/loss
      let profitLoss = 0;
      if (isBet) {
        profitLoss = -amount; // Negative for bets
      } else if (isWin) {
        profitLoss = amount; // Positive for wins
      }
      
      return {
        order_no: transaction.transaction_id,
        provider: transaction.provider,
        game_id: transaction.game_id,
        game_id_hash: transaction.game_id_hash,
        round_id: transaction.round_id,
        type: transaction.type,
        total_bet: isBet ? amount : 0,
        winnings: isWin ? amount : 0,
        profit_loss: profitLoss,
        profit_loss_formatted: profitLoss >= 0 ? `+${profitLoss.toFixed(2)}` : `${profitLoss.toFixed(2)}`,
        balance_before: parseFloat(transaction.wallet_balance_before || 0),
        balance_after: parseFloat(transaction.wallet_balance_after || 0),
        is_freeround_bet: transaction.is_freeround_bet,
        is_freeround_win: transaction.is_freeround_win,
        is_jackpot_win: transaction.is_jackpot_win,
        jackpot_contribution: parseFloat(transaction.jackpot_contribution_in_amount || 0),
        status: transaction.status,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at
      };
    });
    
    // Calculate summary statistics
    const summary = {
      provider: provider,
      total_transactions: total,
      total_bets: processedTransactions.filter(t => t.type === 'debit').length,
      total_wins: processedTransactions.filter(t => t.type === 'credit').length,
      total_bet_amount: processedTransactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.total_bet, 0),
      total_winnings: processedTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + t.winnings, 0),
      net_profit_loss: processedTransactions
        .reduce((sum, t) => sum + t.profit_loss, 0),
      net_profit_loss_formatted: processedTransactions
        .reduce((sum, t) => sum + t.profit_loss, 0) >= 0 
        ? `+${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
        : `${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
    };
    
    // Group by game for additional insights
    const gameStats = {};
    processedTransactions.forEach(transaction => {
      const gameKey = transaction.game_id || transaction.game_id_hash || 'unknown';
      if (!gameStats[gameKey]) {
        gameStats[gameKey] = {
          game_id: transaction.game_id,
          game_id_hash: transaction.game_id_hash,
          total_bets: 0,
          total_wins: 0,
          total_bet_amount: 0,
          total_winnings: 0,
          net_profit_loss: 0
        };
      }
      
      if (transaction.type === 'debit') {
        gameStats[gameKey].total_bets++;
        gameStats[gameKey].total_bet_amount += transaction.total_bet;
        gameStats[gameKey].net_profit_loss -= transaction.total_bet;
      } else if (transaction.type === 'credit') {
        gameStats[gameKey].total_wins++;
        gameStats[gameKey].total_winnings += transaction.winnings;
        gameStats[gameKey].net_profit_loss += transaction.winnings;
      }
    });
    
    res.json({
      success: true,
      data: {
        provider: provider,
        transactions: processedTransactions,
        summary: summary,
        game_stats: gameStats,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / parseInt(limit)),
          total_records: total,
          limit: parseInt(limit),
          has_next_page: parseInt(page) < Math.ceil(total / parseInt(limit)),
          has_prev_page: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting slot game history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching slot game history',
      error: error.message
    });
  }
});

// Get live casino history by provider
router.get('/live-casino/:provider/my-bets', auth, async (req, res) => {
  try {
    const { provider } = req.params;
    const { page = 1, limit = 20, gameId, startDate, endDate, type } = req.query;
    const userId = req.user.user_id;
    
    // Validate provider for live casino
    const validLiveCasinoProviders = ['BombayLive', 'es', 'ev', 'ag', 'vg', 'ez', 'ol', 'bl'];
    
    if (!validLiveCasinoProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider for live casino. Valid providers: BombayLive, es, ev, ag, vg, ez, ol, bl'
      });
    }
    
    // Build where clause for filtering
    let whereClause = { 
      user_id: userId,
      provider: provider
    };
    
    if (gameId) {
      whereClause.game_id = gameId;
    }
    
    if (type) {
      whereClause.type = type;
    }
    
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at.$gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.created_at.$lte = new Date(endDate);
      }
    }
    
    // Get transactions
    const SeamlessTransaction = require('../models/SeamlessTransaction');
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    const total = await SeamlessTransaction.count({
      where: whereClause
    });
    
    // Get transactions with pagination
    const transactions = await SeamlessTransaction.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });
    
    // Process transactions to calculate profit/loss and format data
    const processedTransactions = transactions.map(transaction => {
      const amount = parseFloat(transaction.amount);
      const isBet = transaction.type === 'debit';
      const isWin = transaction.type === 'credit';
      
      // Calculate profit/loss
      let profitLoss = 0;
      if (isBet) {
        profitLoss = -amount; // Negative for bets
      } else if (isWin) {
        profitLoss = amount; // Positive for wins
      }
      
      return {
        order_no: transaction.transaction_id,
        provider: transaction.provider,
        game_id: transaction.game_id,
        game_id_hash: transaction.game_id_hash,
        round_id: transaction.round_id,
        type: transaction.type,
        total_bet: isBet ? amount : 0,
        winnings: isWin ? amount : 0,
        profit_loss: profitLoss,
        profit_loss_formatted: profitLoss >= 0 ? `+${profitLoss.toFixed(2)}` : `${profitLoss.toFixed(2)}`,
        balance_before: parseFloat(transaction.wallet_balance_before || 0),
        balance_after: parseFloat(transaction.wallet_balance_after || 0),
        is_freeround_bet: transaction.is_freeround_bet,
        is_freeround_win: transaction.is_freeround_win,
        is_jackpot_win: transaction.is_jackpot_win,
        jackpot_contribution: parseFloat(transaction.jackpot_contribution_in_amount || 0),
        status: transaction.status,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at
      };
    });
    
    // Calculate summary statistics
    const summary = {
      game_type: 'live_casino',
      provider: provider,
      total_transactions: total,
      total_bets: processedTransactions.filter(t => t.type === 'debit').length,
      total_wins: processedTransactions.filter(t => t.type === 'credit').length,
      total_bet_amount: processedTransactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.total_bet, 0),
      total_winnings: processedTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + t.winnings, 0),
      net_profit_loss: processedTransactions
        .reduce((sum, t) => sum + t.profit_loss, 0),
      net_profit_loss_formatted: processedTransactions
        .reduce((sum, t) => sum + t.profit_loss, 0) >= 0 
        ? `+${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
        : `${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
    };
    
    // Group by game for additional insights
    const gameStats = {};
    processedTransactions.forEach(transaction => {
      const gameKey = transaction.game_id || transaction.game_id_hash || 'unknown';
      if (!gameStats[gameKey]) {
        gameStats[gameKey] = {
          game_id: transaction.game_id,
          game_id_hash: transaction.game_id_hash,
          total_bets: 0,
          total_wins: 0,
          total_bet_amount: 0,
          total_winnings: 0,
          net_profit_loss: 0
        };
      }
      
      if (transaction.type === 'debit') {
        gameStats[gameKey].total_bets++;
        gameStats[gameKey].total_bet_amount += transaction.total_bet;
        gameStats[gameKey].net_profit_loss -= transaction.total_bet;
      } else if (transaction.type === 'credit') {
        gameStats[gameKey].total_wins++;
        gameStats[gameKey].total_winnings += transaction.winnings;
        gameStats[gameKey].net_profit_loss += transaction.winnings;
      }
    });
    
    res.json({
      success: true,
      data: {
        game_type: 'live_casino',
        provider: provider,
        transactions: processedTransactions,
        summary: summary,
        game_stats: gameStats,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / parseInt(limit)),
          total_records: total,
          limit: parseInt(limit),
          has_next_page: parseInt(page) < Math.ceil(total / parseInt(limit)),
          has_prev_page: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting live casino history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching live casino history',
      error: error.message
    });
  }
});

// Get sports betting history by provider
router.get('/sports/:provider/my-bets', auth, async (req, res) => {
  try {
    const { provider } = req.params;
    const { page = 1, limit = 20, gameId, startDate, endDate, type } = req.query;
    const userId = req.user.user_id;
    
    // Validate provider for sports betting
    const validSportsProviders = ['ds', 'dt', 'g24'];
    
    if (!validSportsProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider for sports betting. Valid providers: ds, dt, g24'
      });
    }
    
    // Build where clause for filtering
    let whereClause = { 
      user_id: userId,
      provider: provider
    };
    
    if (gameId) {
      whereClause.game_id = gameId;
    }
    
    if (type) {
      whereClause.type = type;
    }
    
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at.$gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.created_at.$lte = new Date(endDate);
      }
    }
    
    // Get transactions
    const SeamlessTransaction = require('../models/SeamlessTransaction');
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    const total = await SeamlessTransaction.count({
      where: whereClause
    });
    
    // Get transactions with pagination
    const transactions = await SeamlessTransaction.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });
    
    // Process transactions to calculate profit/loss and format data
    const processedTransactions = transactions.map(transaction => {
      const amount = parseFloat(transaction.amount);
      const isBet = transaction.type === 'debit';
      const isWin = transaction.type === 'credit';
      
      // Calculate profit/loss
      let profitLoss = 0;
      if (isBet) {
        profitLoss = -amount; // Negative for bets
      } else if (isWin) {
        profitLoss = amount; // Positive for wins
      }
      
      return {
        order_no: transaction.transaction_id,
        provider: transaction.provider,
        game_id: transaction.game_id,
        game_id_hash: transaction.game_id_hash,
        round_id: transaction.round_id,
        type: transaction.type,
        total_bet: isBet ? amount : 0,
        winnings: isWin ? amount : 0,
        profit_loss: profitLoss,
        profit_loss_formatted: profitLoss >= 0 ? `+${profitLoss.toFixed(2)}` : `${profitLoss.toFixed(2)}`,
        balance_before: parseFloat(transaction.wallet_balance_before || 0),
        balance_after: parseFloat(transaction.wallet_balance_after || 0),
        is_freeround_bet: transaction.is_freeround_bet,
        is_freeround_win: transaction.is_freeround_win,
        is_jackpot_win: transaction.is_jackpot_win,
        jackpot_contribution: parseFloat(transaction.jackpot_contribution_in_amount || 0),
        status: transaction.status,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at
      };
    });
    
    // Calculate summary statistics
    const summary = {
      game_type: 'sports_betting',
      provider: provider,
      total_transactions: total,
      total_bets: processedTransactions.filter(t => t.type === 'debit').length,
      total_wins: processedTransactions.filter(t => t.type === 'credit').length,
      total_bet_amount: processedTransactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.total_bet, 0),
      total_winnings: processedTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + t.winnings, 0),
      net_profit_loss: processedTransactions
        .reduce((sum, t) => sum + t.profit_loss, 0),
      net_profit_loss_formatted: processedTransactions
        .reduce((sum, t) => sum + t.profit_loss, 0) >= 0 
        ? `+${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
        : `${processedTransactions.reduce((sum, t) => sum + t.profit_loss, 0).toFixed(2)}`
    };
    
    // Group by game for additional insights
    const gameStats = {};
    processedTransactions.forEach(transaction => {
      const gameKey = transaction.game_id || transaction.game_id_hash || 'unknown';
      if (!gameStats[gameKey]) {
        gameStats[gameKey] = {
          game_id: transaction.game_id,
          game_id_hash: transaction.game_id_hash,
          total_bets: 0,
          total_wins: 0,
          total_bet_amount: 0,
          total_winnings: 0,
          net_profit_loss: 0
        };
      }
      
      if (transaction.type === 'debit') {
        gameStats[gameKey].total_bets++;
        gameStats[gameKey].total_bet_amount += transaction.total_bet;
        gameStats[gameKey].net_profit_loss -= transaction.total_bet;
      } else if (transaction.type === 'credit') {
        gameStats[gameKey].total_wins++;
        gameStats[gameKey].total_winnings += transaction.winnings;
        gameStats[gameKey].net_profit_loss += transaction.winnings;
      }
    });
    
    res.json({
      success: true,
      data: {
        game_type: 'sports_betting',
        provider: provider,
        transactions: processedTransactions,
        summary: summary,
        game_stats: gameStats,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / parseInt(limit)),
          total_records: total,
          limit: parseInt(limit),
          has_next_page: parseInt(page) < Math.ceil(total / parseInt(limit)),
          has_prev_page: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting sports betting history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching sports betting history',
      error: error.message
    });
  }
});

// Seamless Games Statistics Routes
router.get('/stats/slots', auth, getSlotsStatsController);
router.get('/stats/live-casino', auth, getLiveCasinoStatsController);
router.get('/stats/sports-betting', auth, getSportsBettingStatsController);
router.get('/stats/all', auth, getAllSeamlessGamesStatsController);
router.get('/stats/:gameType/history', auth, getSeamlessGameHistoryController);

module.exports = router;