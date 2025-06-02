const { cacheService } = require('./cacheService');
const { isAdmin } = require('../middleware/authMiddleware');
const axios = require('axios');
const seamlessConfig = require('../config/seamlessConfig');

// Cache duration in seconds (5 days)
const GAME_LIST_CACHE_DURATION = 5 * 24 * 3600; // 5 days in seconds

// Get the correct API URL based on environment
const getApiUrl = () => {
  return process.env.NODE_ENV === 'production' 
    ? seamlessConfig.api_url.production 
    : seamlessConfig.api_url.staging;
};

// Get games list with caching - CORRECTED to use existing API pattern
const getGamesList = async () => {
  try {
    // Try to get from cache first
    const cachedData = await cacheService.getGamesListWithMetadata();
    if (cachedData && cachedData.games && cachedData.games.length > 0) {
      return {
        success: true,
        games: cachedData.games,
        categories: cachedData.categories,
        providers: cachedData.providers,
        fromCache: true
      };
    }

    // If not in cache, fetch from provider using the CORRECT API pattern
    const apiUrl = getApiUrl();
    console.log('🔍 Fetching games from:', apiUrl);
    
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGameList',
      show_systems: 0,
      show_additional: true,
      currency: seamlessConfig.default_currency
    };

    console.log('🔍 Request data:', {
      api_login: requestData.api_login,
      api_password: requestData.api_password ? '***' : 'undefined',
      method: requestData.method
    });

    const response = await axios.post(apiUrl, requestData);

    console.log('✅ API Response status:', response.status);
    console.log('🔍 Response data structure:', {
      hasError: 'error' in response.data,
      error: response.data.error,
      hasResponse: 'response' in response.data,
      responseType: Array.isArray(response.data.response) ? 'array' : typeof response.data.response,
      responseLength: Array.isArray(response.data.response) ? response.data.response.length : 'not array'
    });

    if (response.data.error !== 0) {
      throw new Error(`API Error ${response.data.error}: ${response.data.message || 'Unknown error'}`);
    }

    if (response.data && response.data.response && Array.isArray(response.data.response)) {
      const games = response.data.response;
      
      // Extract categories and providers
      const categories = [...new Set(games.map(game => game.type || game.category).filter(Boolean))];
      const providers = [...new Set(games.map(game => game.system || game.provider).filter(Boolean))];

      // Cache the games list and metadata
      try {
        await cacheService.cacheGamesList(games, {
          categories,
          providers,
          totalCount: games.length,
          lastUpdated: new Date()
        });
        console.log('✅ Games cached successfully');
      } catch (cacheError) {
        console.warn('⚠️ Failed to cache games:', cacheError.message);
      }

      return {
        success: true,
        games: games,
        categories: categories,
        providers: providers,
        totalCount: games.length,
        fromCache: false
      };
    }

    return {
      success: false,
      message: 'No games found in provider response'
    };
  } catch (error) {
    console.error('❌ Error fetching games list:', error.message);
    console.error('❌ API URL:', getApiUrl());
    
    // Try to return cached data as fallback
    try {
      const cachedData = await cacheService.getGamesListWithMetadata();
      if (cachedData && cachedData.games && cachedData.games.length > 0) {
        console.log('🔄 Returning cached data as fallback');
        return {
          success: true,
          games: cachedData.games,
          categories: cachedData.categories,
          providers: cachedData.providers,
          fromCache: true,
          warning: 'Using cached data due to API error'
        };
      }
    } catch (cacheError) {
      console.warn('⚠️ Cache fallback also failed:', cacheError.message);
    }
    
    return {
      success: false,
      message: `Server error fetching games list: ${error.message}`
    };
  }
};

// This provider doesn't use tokens - remove token-based functions
// Instead, we'll use the working seamlessWalletService functions

// Get game URL with caching - CORRECTED to use existing working function
const getGameUrl = async (userId, gameId, language = 'en') => {
  try {
    // Try to get from cache first
    const cachedUrl = await cacheService.getGameUrl(gameId);
    if (cachedUrl) {
      return {
        success: true,
        gameUrl: cachedUrl,
        fromCache: true
      };
    }

    // Use the working seamlessWalletService function
    const seamlessWalletService = require('./seamlessWalletService');
    const result = await seamlessWalletService.getGameUrl(userId, gameId, language);

    // Log the result for debugging
    console.log('🔍 SeamlessWalletService result:', {
      success: result.success,
      hasGameUrl: !!result.gameUrl,
      hasSessionId: !!result.sessionId,
      hasGameSessionId: !!result.gameSessionId,
      warningMessage: result.warningMessage
    });

    if (result.success) {
      // Cache the URL if we have one
      if (result.gameUrl) {
        try {
          await cacheService.cacheGameUrl(gameId, result.gameUrl);
        } catch (cacheError) {
          console.warn('⚠️ Failed to cache game URL:', cacheError.message);
        }
      }

      // Return the complete result from seamlessWalletService
      return {
        success: true,
        gameUrl: result.gameUrl,
        sessionId: result.sessionId,
        gameSessionId: result.gameSessionId,
        warningMessage: result.warningMessage,
        fromCache: false
      };
    }

    // If not successful, return the error
    return {
      success: false,
      message: result.message || 'Failed to get game URL'
    };
  } catch (error) {
    console.error('❌ Error getting game URL:', error);
    return {
      success: false,
      message: 'Server error getting game URL'
    };
  }
};

// Force refresh games list cache (admin only)
const refreshGamesList = async (userId) => {
  try {
    // Check if user is admin
    const isUserAdmin = await isAdmin(userId);
    if (!isUserAdmin) {
      return {
        success: false,
        message: 'Unauthorized: Only admins can refresh the games list'
      };
    }

    // Clear existing cache
    await cacheService.clearGamesCache();
    console.log('🗑️ Games cache cleared');

    // Fetch fresh data using the same method as getGamesList
    const apiUrl = getApiUrl();
    
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGameList',
      show_systems: 0,
      show_additional: true,
      currency: seamlessConfig.default_currency
    };

    const response = await axios.post(apiUrl, requestData);

    if (response.data.error !== 0) {
      throw new Error(`API Error ${response.data.error}: ${response.data.message || 'Unknown error'}`);
    }

    if (response.data && response.data.response && Array.isArray(response.data.response)) {
      const games = response.data.response;
      const categories = [...new Set(games.map(game => game.type || game.category).filter(Boolean))];
      const providers = [...new Set(games.map(game => game.system || game.provider).filter(Boolean))];

      // Cache the new data
      await cacheService.cacheGamesList(games, {
        categories,
        providers,
        totalCount: games.length,
        lastUpdated: new Date()
      });

      return {
        success: true,
        games: games,
        categories: categories,
        providers: providers,
        totalCount: games.length,
        message: 'Games list cache refreshed successfully'
      };
    }

    return {
      success: false,
      message: 'No games found in provider response'
    };
  } catch (error) {
    console.error('❌ Error refreshing games list:', error);
    return {
      success: false,
      message: `Server error refreshing games list: ${error.message}`
    };
  }
};

module.exports = {
  getGamesList,
  getGameUrl,
  refreshGamesList
};