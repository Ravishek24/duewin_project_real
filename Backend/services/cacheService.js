let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




// Cache keys
const CACHE_KEYS = {
  GAMES_LIST: 'seamless:games:list',
  GAME_DETAILS: 'seamless:game:details:',
  GAME_URL: 'seamless:game:url:',
  PROVIDER_TOKEN: 'seamless:provider:token',
  GAME_CATEGORIES: 'seamless:game:categories',
  GAME_PROVIDERS: 'seamless:game:providers'
};

// Cache durations (in seconds)
const CACHE_DURATIONS = {
  GAMES_LIST: 5 * 24 * 3600, // 5 days
  GAME_DETAILS: 7 * 24 * 3600, // 7 days
  GAME_URL: 3600, // 1 hour
  PROVIDER_TOKEN: 3600, // 1 hour
  GAME_CATEGORIES: 7 * 24 * 3600, // 7 days
  GAME_PROVIDERS: 7 * 24 * 3600 // 7 days
};

// Cache service methods
const cacheService = {
  // Get cached data
  async get(key) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  // Set cached data with expiry
  async set(key, data, duration) {
    try {
      await redis.setEx(key, duration, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  },

  // Delete cached data
  async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  },

  // Get multiple cached items
  async mget(keys) {
    try {
      const data = await redis.mGet(keys);
      return data.map(item => item ? JSON.parse(item) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  },

  // Set multiple cached items
  async mset(items, duration) {
    try {
      const pipeline = redis.multi();
      items.forEach(({ key, data }) => {
        pipeline.setEx(key, duration, JSON.stringify(data));
      });
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  },

  // Get games list with categories and providers
  async getGamesListWithMetadata() {
    try {
      const [games, categories, providers] = await this.mget([
        CACHE_KEYS.GAMES_LIST,
        CACHE_KEYS.GAME_CATEGORIES,
        CACHE_KEYS.GAME_PROVIDERS
      ]);

      return {
        games: games || [],
        categories: categories || [],
        providers: providers || []
      };
    } catch (error) {
      console.error('Error getting games list with metadata:', error);
      return {
        games: [],
        categories: [],
        providers: []
      };
    }
  },

  // Cache game details
  async cacheGameDetails(gameId, details) {
    return this.set(
      `${CACHE_KEYS.GAME_DETAILS}${gameId}`,
      details,
      CACHE_DURATIONS.GAME_DETAILS
    );
  },

  // Get game details
  async getGameDetails(gameId) {
    return this.get(`${CACHE_KEYS.GAME_DETAILS}${gameId}`);
  },

  // Cache game URL
  async cacheGameUrl(gameId, url) {
    return this.set(
      `${CACHE_KEYS.GAME_URL}${gameId}`,
      url,
      CACHE_DURATIONS.GAME_URL
    );
  },

  // Get game URL
  async getGameUrl(gameId) {
    return this.get(`${CACHE_KEYS.GAME_URL}${gameId}`);
  },

  // Cache provider token
  async cacheProviderToken(token) {
    return this.set(
      CACHE_KEYS.PROVIDER_TOKEN,
      token,
      CACHE_DURATIONS.PROVIDER_TOKEN
    );
  },

  // Get provider token
  async getProviderToken() {
    return this.get(CACHE_KEYS.PROVIDER_TOKEN);
  },

  // Cache games list
  async cacheGamesList(games) {
    // Extract and cache categories and providers
    const categories = [...new Set(games.map(game => game.category))];
    const providers = [...new Set(games.map(game => game.provider))];

    // Cache all data
    await this.mset([
      { key: CACHE_KEYS.GAMES_LIST, data: games },
      { key: CACHE_KEYS.GAME_CATEGORIES, data: categories },
      { key: CACHE_KEYS.GAME_PROVIDERS, data: providers }
    ], CACHE_DURATIONS.GAMES_LIST);

    return true;
  },

  // Get games list
  async getGamesList() {
    return this.get(CACHE_KEYS.GAMES_LIST);
  },

  // Clear all game-related cache
  async clearGamesCache() {
    try {
      const keys = await redis.keys('seamless:game:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Error clearing games cache:', error);
      return false;
    }
  }
};

module.exports = {
  cacheService,
  CACHE_KEYS,
  CACHE_DURATIONS
}; 
