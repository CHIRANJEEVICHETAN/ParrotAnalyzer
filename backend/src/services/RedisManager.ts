import { Redis, RedisOptions } from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Robust Redis Manager for handling connection issues and graceful fallbacks
 */
export class RedisManager extends EventEmitter {
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly baseReconnectDelay: number = 1000; // 1 second
  private readonly maxReconnectDelay: number = 30000; // 30 seconds
  private localCache: Map<string, { value: string; expiry: number }> = new Map();
  private useFallback: boolean = false;

  /**
   * Creates a new Redis Manager instance
   * @param redisUrl Redis connection URL
   * @param options Redis connection options
   */
  constructor(
    private readonly redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379',
    private readonly options: RedisOptions = {}
  ) {
    super();
    
    // Set up connection retry and error handling
    this.connect();
  }

  /**
   * Creates and configures Redis connection with proper error handling
   */
  private connect(): void {
    try {
      // Close existing connection if any
      if (this.redis) {
        this.redis.disconnect();
      }

      // Merge default options with user provided options
      const connectionOptions: RedisOptions = {
        retryStrategy: (times: number) => {
          const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, times),
            this.maxReconnectDelay
          );
          return delay;
        },
        // Error handler is set in setupEventHandlers
        ...this.options
      };

      // Create new Redis instance
      this.redis = new Redis(this.redisUrl, connectionOptions);
      
      // Setup event handlers
      this.setupEventHandlers();
      
      console.log('Redis connection initialized');
    } catch (error) {
      console.error('Failed to initialize Redis connection:', error);
      this.handleConnectionFailure(error);
    }
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    if (!this.redis) return;

    this.redis.on('connect', () => {
      console.log('Redis connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.useFallback = false;
      this.emit('connect');
    });

    this.redis.on('ready', () => {
      console.log('Redis ready');
      this.emit('ready');
    });

    this.redis.on('error', (error) => {
      console.error('Redis error:', error);
      this.emit('error', error);
      
      // Don't handle connection errors here, they're handled by 'close' event
      if (!this.isConnected) {
        this.handleConnectionFailure(error);
      }
    });

    this.redis.on('close', () => {
      console.log('Redis connection closed');
      this.isConnected = false;
      this.emit('close');
      
      this.handleConnectionFailure(new Error('Connection closed'));
    });

    this.redis.on('reconnecting', (delay: number) => {
      console.log(`Redis reconnecting in ${delay}ms...`);
      this.emit('reconnecting', delay);
    });

    // Added to prevent unhandled error events
    this.redis.on('end', () => {
      console.log('Redis connection ended');
      this.isConnected = false;
      this.emit('end');
    });
  }

  /**
   * Handle connection failure by scheduling reconnect or using fallback
   */
  private handleConnectionFailure(error: any): void {
    this.isConnected = false;
    this.reconnectAttempts++;

    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      const delay = Math.min(
        this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectDelay
      );
      
      console.log(`Scheduling Redis reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      // Clear any existing timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
      
      // Schedule reconnect
      this.reconnectTimer = setTimeout(() => {
        console.log(`Attempting to reconnect to Redis (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect();
      }, delay);
    } else {
      console.warn('Max Redis reconnect attempts reached, switching to fallback mode');
      this.useFallback = true;
      this.emit('fallback');
    }
  }

  /**
   * Get a value from Redis with fallback to local cache
   * @param key The key to get
   * @returns Promise with the value or null if not found
   */
  async get(key: string): Promise<string | null> {
    try {
      if (this.useFallback || !this.isConnected || !this.redis) {
        return this.getFromLocalCache(key);
      }
      
      const value = await this.redis.get(key);
      return value;
    } catch (error) {
      console.error(`Error getting key ${key} from Redis:`, error);
      return this.getFromLocalCache(key);
    }
  }

  /**
   * Set a value in Redis with fallback to local cache
   * @param key The key to set
   * @param value The value to set
   * @param ttl TTL in seconds
   * @returns Promise indicating success
   */
  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      // Always update local cache regardless of Redis connection status
      this.updateLocalCache(key, value, ttl);
      
      if (this.useFallback || !this.isConnected || !this.redis) {
        return true; // Stored in local cache
      }
      
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`Error setting key ${key} in Redis:`, error);
      return true; // We've already stored in local cache
    }
  }

  /**
   * Delete a key from Redis with fallback to local cache
   * @param key The key to delete
   * @returns Promise indicating success
   */
  async del(key: string): Promise<boolean> {
    try {
      // Always remove from local cache
      this.localCache.delete(key);
      
      if (this.useFallback || !this.isConnected || !this.redis) {
        return true; // Removed from local cache
      }
      
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`Error deleting key ${key} from Redis:`, error);
      return true; // We've already removed from local cache
    }
  }

  /**
   * Execute pipeline commands with fallback for simple commands
   * @param pipeline Function that builds the pipeline
   * @returns Promise with results
   */
  async pipeline(pipeline: (pipeline: any) => void): Promise<any[]> {
    try {
      if (this.useFallback || !this.isConnected || !this.redis) {
        console.warn('Redis not available, pipeline operations in fallback mode may be incomplete');
        return [];
      }
      
      const pipe = this.redis.pipeline();
      pipeline(pipe);
      const results = await pipe.exec();
      return results || [];
    } catch (error) {
      console.error('Error executing Redis pipeline:', error);
      return [];
    }
  }

  /**
   * Get Redis client instance (use with caution)
   * @returns The Redis client or null if in fallback mode
   */
  getClient(): Redis | null {
    if (this.useFallback || !this.isConnected) {
      console.warn('Redis not connected, operations may fail');
    }
    return this.redis;
  }

  /**
   * Check if Redis is connected
   * @returns True if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected && !this.useFallback && !!this.redis;
  }

  /**
   * Force reconnect to Redis
   */
  forceReconnect(): void {
    console.log('Forcing Redis reconnection...');
    this.reconnectAttempts = 0;
    this.useFallback = false;
    this.connect();
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.redis) {
      this.redis.disconnect();
    }
    
    this.localCache.clear();
    this.removeAllListeners();
  }

  /**
   * Get a value from local cache
   * @param key The key to get
   * @returns The value or null if not found or expired
   */
  private getFromLocalCache(key: string): string | null {
    const cachedItem = this.localCache.get(key);
    if (!cachedItem) return null;
    
    if (cachedItem.expiry && cachedItem.expiry < Date.now()) {
      // Expired
      this.localCache.delete(key);
      return null;
    }
    
    return cachedItem.value;
  }

  /**
   * Update local cache with a value
   * @param key The key to set
   * @param value The value to set
   * @param ttl TTL in seconds
   */
  private updateLocalCache(key: string, value: string, ttl?: number): void {
    const expiry = ttl ? Date.now() + (ttl * 1000) : undefined;
    this.localCache.set(key, { value, expiry: expiry || 0 });
    
    // Clean up expired items occasionally
    if (Math.random() < 0.1) {
      this.cleanupExpiredCache();
    }
  }

  /**
   * Remove expired items from local cache
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, item] of this.localCache.entries()) {
      if (item.expiry && item.expiry < now) {
        this.localCache.delete(key);
      }
    }
  }
} 