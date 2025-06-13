const { cacheService } = require('./cacheService');
const { isAdmin } = require('../middleware/authMiddleware');
const axios = require('axios');
const seamlessConfig = require('../config/seamlessConfig');
const crypto = require('crypto');

// Cache duration in seconds (5 days)
const GAME_LIST_CACHE_DURATION = 5 * 24 * 3600; // 5 days in seconds

// Get the correct API URL based on environment
const getApiUrl = () => {
  return process.env.NODE_ENV === 'production' 
    ? seamlessConfig.api_url.production 
    : seamlessConfig.api_url.staging;
};

// Generate hash for request validation
const generateHash = (data, salt) => {
  // Sort the data object by keys
  const sortedData = Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});

  // Create query string
  const queryString = Object.entries(sortedData)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  // Generate SHA1 hash
  return crypto.createHash('sha1')
    .update(salt + queryString)
    .digest('hex');
};

// Get games list with caching - CORRECTED to use existing API pattern
const getGamesList = async (filters = {}) => {
  try {
    // Try to get from cache first
    const cachedData = await cacheService.getGamesListWithMetadata();
    let games = [];
    let categories = [];
    let providers = [];

    if (cachedData && cachedData.games && cachedData.games.length > 0) {
      games = cachedData.games;
      categories = cachedData.categories;
      providers = cachedData.providers;
    } else {
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

      // Generate hash for request validation
      const hash = generateHash(requestData, seamlessConfig.salt_key);
      requestData.key = hash;

      console.log('🔍 Request data:', {
        api_login: requestData.api_login,
        api_password: requestData.api_password ? '***' : 'undefined',
        method: requestData.method
      });

      const response = await axios.post(apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('✅ API Response status:', response.status);
      console.log('🔍 Response headers:', response.headers);
      console.log('🔍 Response data type:', typeof response.data);
      
      // Check if response is HTML instead of JSON
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
        console.error('❌ Received HTML response instead of JSON');
        throw new Error('Provider returned HTML response. Please check server configuration and IP whitelisting.');
      }

      // Check if response has the expected structure
      if (!response.data || typeof response.data !== 'object') {
        console.error('❌ Invalid response format:', response.data);
        throw new Error('Invalid response format from provider');
      }

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

      // Process the response
      games = response.data.response || [];
      categories = [...new Set(games.map(game => game.category))].filter(Boolean);
      providers = [...new Set(games.map(game => game.system))].filter(Boolean);

      // Cache the results
      await cacheService.cacheGamesList(games);
    }

    // Apply filters
    let filteredGames = [...games];

    // Filter by provider
    if (filters.provider) {
      const provider = filters.provider.toLowerCase();
      filteredGames = filteredGames.filter(game => 
        game.system?.toLowerCase() === provider ||
        game.subcategory?.toLowerCase().includes(provider)
      );
    }

    // Filter by category
    if (filters.category) {
      const category = filters.category.toLowerCase();
      filteredGames = filteredGames.filter(game => 
        game.category?.toLowerCase() === category ||
        game.type?.toLowerCase() === category
      );
    }

    // Filter by mobile
    if (filters.mobile === true) {
      filteredGames = filteredGames.filter(game => game.mobile === true);
    }

    // Filter by jackpot
    if (filters.jackpot === true) {
      filteredGames = filteredGames.filter(game => game.has_jackpot === true);
    }

    // Filter by freerounds
    if (filters.freerounds === true) {
      filteredGames = filteredGames.filter(game => game.freerounds_supported === true);
    }

    // Apply pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedGames = filteredGames.slice(startIndex, endIndex);

    return {
      success: true,
      games: paginatedGames,
      totalCount: games.length,
      filteredCount: filteredGames.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredGames.length / limit),
        totalItems: filteredGames.length,
        itemsPerPage: limit
      },
      fromCache: cachedData ? true : false
    };
  } catch (error) {
    console.error('❌ Error fetching games list:', error.message);
    console.error('❌ API URL:', getApiUrl());
    if (error.response) {
      console.error('❌ Response status:', error.response.status);
      console.error('❌ Response headers:', error.response.headers);
      console.error('❌ Response data:', error.response.data);
    }
    return {
      success: false,
      message: error.message || 'Failed to fetch games list',
      error: error.response?.data || error.message
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