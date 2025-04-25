import { Redis } from 'ioredis';
import { LocationUpdate } from '../types/liveTracking';
import { RedisManager } from './RedisManager';

export class RetryService {
    private redis: RedisManager;
    private readonly MAX_RETRIES = 3;
    private readonly BASE_DELAY = 1000; // 1 second
    private readonly MAX_DELAY = 10000; // 10 seconds

    constructor() {
        this.redis = new RedisManager(process.env.REDIS_URL || 'redis://localhost:6379');
    }

    async queueForRetry(userId: number, data: LocationUpdate, error: Error): Promise<void> {
        const retryKey = `retry:location:${userId}`;
        const countKey = `${retryKey}:count`;
        
        // Get current retry count
        let retryCount = 1;
        const countStr = await this.redis.get(countKey);
        
        if (countStr) {
            retryCount = parseInt(countStr, 10) + 1;
        }
        
        // Store the updated count
        await this.redis.set(countKey, retryCount.toString());

        if (retryCount > this.MAX_RETRIES) {
            await this.handleMaxRetriesExceeded(userId, data, error);
            return;
        }

        const delay = Math.min(
            this.BASE_DELAY * Math.pow(2, retryCount - 1),
            this.MAX_DELAY
        );

        await this.redis.set(
            retryKey,
            JSON.stringify({
                data,
                error: error.message,
                retryCount,
                timestamp: new Date().toISOString()
            }),
            Math.ceil(delay / 1000)
        );
        
        // Add to retry keys index
        await this.addRetryKey(retryKey);

        // Log retry attempt
        console.log(`Queued retry #${retryCount} for user ${userId} with delay ${delay}ms`);
    }

    private async handleMaxRetriesExceeded(userId: number, data: LocationUpdate, error: Error): Promise<void> {
        // Store failed update in dead letter queue
        const deadLetterKey = `dead:location:${userId}:${new Date().toISOString()}`;
        await this.redis.set(deadLetterKey, JSON.stringify({
            data,
            error: error.message,
            retryCount: this.MAX_RETRIES,
            timestamp: new Date().toISOString()
        }));
        
        // Add to dead letter keys index
        await this.addDeadLetterKey(userId, deadLetterKey);

        // Clean up retry counters
        await this.redis.del(`retry:location:${userId}:count`);

        // Log failure
        console.error(`Max retries exceeded for user ${userId}. Update moved to dead letter queue.`);
    }

    async processRetryQueue(): Promise<void> {
        // Since RedisManager doesn't support pattern matching directly,
        // we'll handle it differently by using a special key to store all retry keys
        const retryKeysKey = 'retry:location:keys';
        const retryKeysStr = await this.redis.get(retryKeysKey);
        let retryKeys: string[] = [];
        
        if (retryKeysStr) {
            try {
                retryKeys = JSON.parse(retryKeysStr);
                if (!Array.isArray(retryKeys)) {
                    retryKeys = [];
                }
            } catch (e) {
                console.error('Error parsing retry keys from Redis:', e);
                retryKeys = [];
            }
        }

        for (const key of retryKeys) {
            if (key.endsWith(':count')) continue;

            const data = await this.redis.get(key);
            if (!data) {
                // Remove this key from the list if it no longer exists
                retryKeys = retryKeys.filter(k => k !== key);
                continue;
            }

            try {
                const retryData = JSON.parse(data);
                // Emit event for retry processing
                // This should be handled by your event emitter or message queue
                console.log(`Processing retry for key ${key}:`, retryData);
                
                // Clean up processed retry
                await this.redis.del(key);
                // Also remove from the keys list
                retryKeys = retryKeys.filter(k => k !== key);
            } catch (error) {
                console.error(`Error processing retry for key ${key}:`, error);
            }
        }
        
        // Update the list of retry keys
        await this.redis.set(retryKeysKey, JSON.stringify(retryKeys));
    }

    async getFailedUpdates(userId: number): Promise<any[]> {
        // Dead letter queue keys are stored in a separate list
        const deadLetterKeysKey = `dead:location:${userId}:keys`;
        const deadLetterKeysStr = await this.redis.get(deadLetterKeysKey);
        let deadLetterKeys: string[] = [];
        
        if (deadLetterKeysStr) {
            try {
                deadLetterKeys = JSON.parse(deadLetterKeysStr);
                if (!Array.isArray(deadLetterKeys)) {
                    deadLetterKeys = [];
                }
            } catch (e) {
                console.error('Error parsing dead letter keys from Redis:', e);
                deadLetterKeys = [];
            }
        }
        
        const updates: any[] = [];

        for (const key of deadLetterKeys) {
            const data = await this.redis.get(key);
            if (data) {
                try {
                    updates.push(JSON.parse(data));
                } catch (error) {
                    console.error(`Error parsing data for key ${key}:`, error);
                }
            } else {
                // Remove this key from the list if it no longer exists
                deadLetterKeys = deadLetterKeys.filter(k => k !== key);
            }
        }
        
        // Update the list of dead letter keys
        await this.redis.set(deadLetterKeysKey, JSON.stringify(deadLetterKeys));

        return updates;
    }
    
    // Helper method to add a key to the retry keys list
    async addRetryKey(key: string): Promise<void> {
        const retryKeysKey = 'retry:location:keys';
        const retryKeysStr = await this.redis.get(retryKeysKey);
        let retryKeys: string[] = [];
        
        if (retryKeysStr) {
            try {
                retryKeys = JSON.parse(retryKeysStr);
                if (!Array.isArray(retryKeys)) {
                    retryKeys = [];
                }
            } catch (e) {
                console.error('Error parsing retry keys from Redis:', e);
                retryKeys = [];
            }
        }
        
        if (!retryKeys.includes(key)) {
            retryKeys.push(key);
            await this.redis.set(retryKeysKey, JSON.stringify(retryKeys));
        }
    }
    
    // Helper method to add a key to the dead letter keys list
    async addDeadLetterKey(userId: number, key: string): Promise<void> {
        const deadLetterKeysKey = `dead:location:${userId}:keys`;
        const deadLetterKeysStr = await this.redis.get(deadLetterKeysKey);
        let deadLetterKeys: string[] = [];
        
        if (deadLetterKeysStr) {
            try {
                deadLetterKeys = JSON.parse(deadLetterKeysStr);
                if (!Array.isArray(deadLetterKeys)) {
                    deadLetterKeys = [];
                }
            } catch (e) {
                console.error('Error parsing dead letter keys from Redis:', e);
                deadLetterKeys = [];
            }
        }
        
        if (!deadLetterKeys.includes(key)) {
            deadLetterKeys.push(key);
            await this.redis.set(deadLetterKeysKey, JSON.stringify(deadLetterKeys));
        }
    }
} 