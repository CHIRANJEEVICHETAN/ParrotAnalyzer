import { Redis } from 'ioredis';
import { pool } from '../config/database';

interface BatteryState {
    batteryLevel: number;
    isCharging: boolean;
    lastUpdateTime: number;
    currentInterval: number;
}

interface MovementState {
    isMoving: boolean;
    speed: number;
    lastStateChange: number;
    consecutiveStationary: number;
}

export class BatteryOptimizationService {
    private redis: Redis;
    private readonly MIN_UPDATE_INTERVAL = 10000; // 10 seconds
    private readonly MAX_UPDATE_INTERVAL = 300000; // 5 minutes
    private readonly CRITICAL_BATTERY_LEVEL = 15;
    private readonly LOW_BATTERY_LEVEL = 25;
    private readonly STATE_TTL = 86400; // 24 hours in seconds
    private readonly MOVEMENT_THRESHOLD = 0.5; // meters per second

    constructor() {
        this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }

    async getOptimalUpdateInterval(
        userId: number,
        batteryLevel: number,
        isCharging: boolean,
        speed: number,
        isInGeofence: boolean
    ): Promise<number> {
        try {
            // Get current states
            const [batteryState, movementState] = await Promise.all([
                this.getBatteryState(userId),
                this.getMovementState(userId)
            ]);

            // Update states
            await Promise.all([
                this.updateBatteryState(userId, batteryLevel, isCharging),
                this.updateMovementState(userId, speed)
            ]);

            // Calculate base interval
            let interval = this.calculateBaseInterval(batteryLevel, isCharging);

            // Adjust for movement
            interval = this.adjustForMovement(interval, speed, movementState);

            // Adjust for geofence
            interval = this.adjustForGeofence(interval, isInGeofence);

            // Adjust for battery level
            interval = this.adjustForBatteryLevel(interval, batteryLevel);

            // Get company settings
            const settings = await this.getCompanySettings(userId);
            if (settings) {
                interval = Math.max(interval, settings.min_update_interval);
                interval = Math.min(interval, settings.max_update_interval);
            }

            return Math.min(Math.max(interval, this.MIN_UPDATE_INTERVAL), this.MAX_UPDATE_INTERVAL);
        } catch (error) {
            console.error('Error calculating optimal update interval:', error);
            return this.MIN_UPDATE_INTERVAL;
        }
    }

    private async getBatteryState(userId: number): Promise<BatteryState | null> {
        const state = await this.redis.get(`battery:${userId}`);
        return state ? JSON.parse(state) : null;
    }

    private async getMovementState(userId: number): Promise<MovementState | null> {
        const state = await this.redis.get(`movement:${userId}`);
        return state ? JSON.parse(state) : null;
    }

    private async updateBatteryState(userId: number, batteryLevel: number, isCharging: boolean): Promise<void> {
        const currentTime = Date.now();
        const state: BatteryState = {
            batteryLevel,
            isCharging,
            lastUpdateTime: currentTime,
            currentInterval: this.MIN_UPDATE_INTERVAL
        };
        await this.redis.setex(`battery:${userId}`, this.STATE_TTL, JSON.stringify(state));
    }

    private async updateMovementState(userId: number, speed: number): Promise<void> {
        const currentTime = Date.now();
        const oldState = await this.getMovementState(userId);
        
        const isMoving = speed > this.MOVEMENT_THRESHOLD;
        const state: MovementState = {
            isMoving,
            speed,
            lastStateChange: oldState && oldState.isMoving === isMoving ? 
                oldState.lastStateChange : currentTime,
            consecutiveStationary: isMoving ? 0 : 
                (oldState ? oldState.consecutiveStationary + 1 : 1)
        };
        
        await this.redis.setex(`movement:${userId}`, this.STATE_TTL, JSON.stringify(state));
    }

    private calculateBaseInterval(batteryLevel: number, isCharging: boolean): number {
        if (isCharging) {
            return this.MIN_UPDATE_INTERVAL;
        }

        if (batteryLevel <= this.CRITICAL_BATTERY_LEVEL) {
            return this.MAX_UPDATE_INTERVAL;
        }

        if (batteryLevel <= this.LOW_BATTERY_LEVEL) {
            return this.MAX_UPDATE_INTERVAL * 0.75;
        }

        return this.MIN_UPDATE_INTERVAL * 2;
    }

    private adjustForMovement(interval: number, speed: number, state: MovementState | null): number {
        if (!state) {
            return interval;
        }

        if (speed > this.MOVEMENT_THRESHOLD) {
            // Moving: more frequent updates
            return Math.max(interval * 0.5, this.MIN_UPDATE_INTERVAL);
        }

        // Stationary: gradually increase interval
        const stationaryMultiplier = Math.min(state.consecutiveStationary, 5);
        return Math.min(interval * (1 + stationaryMultiplier * 0.5), this.MAX_UPDATE_INTERVAL);
    }

    private adjustForGeofence(interval: number, isInGeofence: boolean): number {
        // More frequent updates near geofence boundaries
        return isInGeofence ? interval * 0.75 : interval;
    }

    private adjustForBatteryLevel(interval: number, batteryLevel: number): number {
        if (batteryLevel > 75) {
            return interval;
        }

        // Gradually increase interval as battery decreases
        const batteryMultiplier = 1 + ((75 - batteryLevel) / 75);
        return Math.min(interval * batteryMultiplier, this.MAX_UPDATE_INTERVAL);
    }

    private async getCompanySettings(userId: number): Promise<any | null> {
        try {
          // Query using the actual column names from the schema
          const result = await pool.query(
            `SELECT cs.update_interval_seconds, cs.battery_saving_enabled, cs.default_tracking_precision
                 FROM company_tracking_settings cs
                 JOIN users u ON u.company_id = cs.company_id
                 WHERE u.id = $1`,
            [userId]
          );

          if (result.rows.length > 0) {
            // Map to the expected property names
            const settings = result.rows[0];
            return {
              min_update_interval: settings.update_interval_seconds * 1000, // Convert seconds to milliseconds
              max_update_interval: settings.battery_saving_enabled
                ? this.MAX_UPDATE_INTERVAL
                : settings.update_interval_seconds * 1000,
              tracking_precision:
                settings.default_tracking_precision || "medium",
            };
          }

          console.log("No company settings found for user, using defaults");
          return {
            min_update_interval: this.MIN_UPDATE_INTERVAL,
            max_update_interval: this.MAX_UPDATE_INTERVAL,
            tracking_precision: "medium",
          };
        } catch (error) {
          console.error("Error fetching company settings:", error);
          // Return default values on error
          return {
            min_update_interval: this.MIN_UPDATE_INTERVAL,
            max_update_interval: this.MAX_UPDATE_INTERVAL,
            tracking_precision: "medium",
          };
        }
    }

    async clearState(userId: number): Promise<void> {
        await Promise.all([
            this.redis.del(`battery:${userId}`),
            this.redis.del(`movement:${userId}`)
        ]);
    }
} 