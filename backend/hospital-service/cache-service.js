const redis = require('redis');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'cache-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

class CacheService {
  constructor() {
    this.redisClient = null;
    this.inMemoryCache = new Map();
    this.isRedisConnected = false;
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redisClient = redis.createClient({
        url: redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.warn('Redis connection refused, falling back to in-memory cache');
            return undefined; // Don't retry
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.redisClient.on('connect', () => {
        logger.info('Connected to Redis cache');
        this.isRedisConnected = true;
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis connection error, using in-memory cache', { error: err.message });
        this.isRedisConnected = false;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.warn('Failed to initialize Redis, using in-memory cache only', { error: error.message });
      this.isRedisConnected = false;
    }
  }

  /**
   * Get cached data with fallback to in-memory cache
   */
  async get(key) {
    try {
      if (this.isRedisConnected && this.redisClient) {
        const value = await this.redisClient.get(key);
        if (value) {
          logger.debug('Cache hit (Redis)', { key });
          return JSON.parse(value);
        }
      }

      // Fallback to in-memory cache
      if (this.inMemoryCache.has(key)) {
        const cached = this.inMemoryCache.get(key);
        if (cached.expiry > Date.now()) {
          logger.debug('Cache hit (in-memory)', { key });
          return cached.data;
        } else {
          this.inMemoryCache.delete(key);
        }
      }

      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key, data, ttlSeconds = 3600) {
    try {
      const serializedData = JSON.stringify(data);

      if (this.isRedisConnected && this.redisClient) {
        await this.redisClient.setEx(key, ttlSeconds, serializedData);
        logger.debug('Cache set (Redis)', { key, ttl: ttlSeconds });
      } else {
        // Fallback to in-memory cache
        const expiry = Date.now() + (ttlSeconds * 1000);
        this.inMemoryCache.set(key, { data, expiry });
        logger.debug('Cache set (in-memory)', { key, ttl: ttlSeconds });
        
        // Clean up expired entries periodically
        this.cleanupInMemoryCache();
      }
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
    }
  }

  /**
   * Delete cached data
   */
  async delete(key) {
    try {
      if (this.isRedisConnected && this.redisClient) {
        await this.redisClient.del(key);
      }
      this.inMemoryCache.delete(key);
      logger.debug('Cache deleted', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern) {
    try {
      if (this.isRedisConnected && this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
          logger.info('Cache pattern deleted (Redis)', { pattern, count: keys.length });
        }
      }

      // Clean in-memory cache
      for (const key of this.inMemoryCache.keys()) {
        if (this.matchPattern(key, pattern)) {
          this.inMemoryCache.delete(key);
        }
      }
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error: error.message });
    }
  }

  /**
   * Get or set cached data (cache-aside pattern)
   */
  async getOrSet(key, fetchFunction, ttlSeconds = 3600) {
    try {
      // Try to get from cache first
      let data = await this.get(key);
      
      if (data !== null) {
        return data;
      }

      // Cache miss - fetch data
      logger.debug('Cache miss, fetching data', { key });
      data = await fetchFunction();
      
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttlSeconds);
      }

      return data;
    } catch (error) {
      logger.error('Cache getOrSet error', { key, error: error.message });
      // Return fresh data on cache error
      return await fetchFunction();
    }
  }

  /**
   * Clean up expired in-memory cache entries
   */
  cleanupInMemoryCache() {
    const now = Date.now();
    for (const [key, cached] of this.inMemoryCache.entries()) {
      if (cached.expiry <= now) {
        this.inMemoryCache.delete(key);
      }
    }
  }

  /**
   * Simple pattern matching for cache keys
   */
  matchPattern(key, pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const stats = {
        inMemorySize: this.inMemoryCache.size,
        redisConnected: this.isRedisConnected
      };

      if (this.isRedisConnected && this.redisClient) {
        const info = await this.redisClient.info('memory');
        stats.redisMemory = info;
      }

      return stats;
    } catch (error) {
      logger.error('Error getting cache stats', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Cache key generators
   */
  static keys = {
    hospital: (id) => `hospital:${id}`,
    hospitalList: (filters = '') => `hospitals:list:${filters}`,
    userSession: (userId) => `session:${userId}`,
    hospitalsByLocation: (lat, lng, radius) => `hospitals:location:${lat}:${lng}:${radius}`,
    hospitalServices: (hospitalId) => `hospital:${hospitalId}:services`,
    searchResults: (query) => `search:${Buffer.from(query).toString('base64')}`
  };

  /**
   * Cache TTL constants (in seconds)
   */
  static TTL = {
    HOSPITAL_DETAILS: 3600,      // 1 hour - hospital data changes infrequently
    HOSPITAL_LIST: 900,          // 15 minutes - list may change with new hospitals
    USER_SESSION: 86400,         // 24 hours - user session data
    SEARCH_RESULTS: 300,         // 5 minutes - search results can be dynamic
    LOCATION_SEARCH: 1800,       // 30 minutes - location-based searches
    HOSPITAL_SERVICES: 7200      // 2 hours - services don't change often
  };
}

module.exports = new CacheService();
