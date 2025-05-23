const { cacheService } = require('./cacheService');
const { isAdmin } = require('../middleware/authMiddleware');
const axios = require('axios');
const seamlessConfig = require('../config/seamlessConfig');

// Cache duration in seconds (5 days)
const GAME_LIST_CACHE_DURATION = 5 * 24 * 3600; // 5 days in seconds

// Get games list with caching
const getGamesList = async () => {
  try {
    // Try to get from cache first
    const cachedData = await cacheService.getGamesListWithMetadata();
    if (cachedData.games && cachedData.games.length > 0) {
      return {
        success: true,
        games: cachedData.games,
        categories: cachedData.categories,
        providers: cachedData.providers,
        fromCache: true
      };
    }

    // If not in cache, fetch from provider
    const response = await axios.get(`${seamlessConfig.apiBaseUrl}/games`, {
      headers: {
        'Authorization': `Bearer ${await getProviderToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.games) {
      // Cache the games list and metadata
      await cacheService.cacheGamesList(response.data.games);

      return {
        success: true,
        games: response.data.games,
        categories: [...new Set(response.data.games.map(game => game.category))],
        providers: [...new Set(response.data.games.map(game => game.provider))],
        fromCache: false
      };
    }

    return {
      success: false,
      message: 'No games found in provider response'
    };
  } catch (error) {
    console.error('Error fetching games list:', error);
    return {
      success: false,
      message: 'Server error fetching games list'
    };
  }
};

// Get provider token with caching
const getProviderToken = async () => {
  try {
    // Try to get from cache first
    const cachedToken = await cacheService.getProviderToken();
    if (cachedToken) {
      return cachedToken;
    }

    // If not in cache, fetch new token
    const response = await axios.post(`${seamlessConfig.apiBaseUrl}/auth`, {
      client_id: seamlessConfig.clientId,
      client_secret: seamlessConfig.clientSecret
    });

    if (response.data && response.data.token) {
      // Cache the token
      await cacheService.cacheProviderToken(response.data.token);
      return response.data.token;
    }

    throw new Error('No token in provider response');
  } catch (error) {
    console.error('Error getting provider token:', error);
    throw error;
  }
};

// Get game URL with caching
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

    // If not in cache, fetch from provider
    const response = await axios.post(
      `${seamlessConfig.apiBaseUrl}/games/${gameId}/launch`,
      {
        user_id: userId,
        language
      },
      {
        headers: {
          'Authorization': `Bearer ${await getProviderToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.url) {
      // Cache the URL
      await cacheService.cacheGameUrl(gameId, response.data.url);

      return {
        success: true,
        gameUrl: response.data.url,
        fromCache: false
      };
    }

    return {
      success: false,
      message: 'No game URL in provider response'
    };
  } catch (error) {
    console.error('Error getting game URL:', error);
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

    // Fetch fresh data
    const response = await axios.get(`${seamlessConfig.apiBaseUrl}/games`, {
      headers: {
        'Authorization': `Bearer ${await getProviderToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.games) {
      // Cache the new data
      await cacheService.cacheGamesList(response.data.games);

      return {
        success: true,
        games: response.data.games,
        categories: [...new Set(response.data.games.map(game => game.category))],
        providers: [...new Set(response.data.games.map(game => game.provider))],
        message: 'Games list cache refreshed successfully'
      };
    }

    return {
      success: false,
      message: 'No games found in provider response'
    };
  } catch (error) {
    console.error('Error refreshing games list:', error);
    return {
      success: false,
      message: 'Server error refreshing games list'
    };
  }
};

module.exports = {
  getGamesList,
  getGameUrl,
  refreshGamesList
}; 