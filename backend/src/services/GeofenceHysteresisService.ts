import { Redis } from 'ioredis';

interface GeofenceState {
    isInside: boolean;
    lastTransitionTime: number;
    consecutiveCount: number;
}

export class GeofenceHysteresisService {
    private redis: Redis;
    private readonly HYSTERESIS_THRESHOLD = 3; // Number of consecutive readings needed
    private readonly MIN_TIME_BETWEEN_TRANSITIONS = 60000; // 1 minute in milliseconds
    private readonly STATE_TTL = 86400; // 24 hours in seconds

    constructor() {
        this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }

    async validateGeofenceState(
        userId: number,
        geofenceId: number,
        isCurrentlyInside: boolean
    ): Promise<{ isInside: boolean; transitionOccurred: boolean }> {
        const stateKey = `geofence:hysteresis:${userId}:${geofenceId}`;
        
        try {
            // Get current state from Redis
            const currentState = await this.getState(stateKey);
            
            if (!currentState) {
                // Initialize state for first reading
                const newState: GeofenceState = {
                    isInside: isCurrentlyInside,
                    lastTransitionTime: Date.now(),
                    consecutiveCount: 1
                };
                await this.setState(stateKey, newState);
                return { isInside: isCurrentlyInside, transitionOccurred: true };
            }

            // Check if the current reading matches the stored state
            if (isCurrentlyInside === currentState.isInside) {
                // Reset consecutive count if it's been too long since last reading
                if (Date.now() - currentState.lastTransitionTime > this.MIN_TIME_BETWEEN_TRANSITIONS) {
                    currentState.consecutiveCount = 1;
                } else {
                    currentState.consecutiveCount++;
                }
                await this.setState(stateKey, currentState);
                return { isInside: currentState.isInside, transitionOccurred: false };
            }

            // Current reading differs from stored state
            if (Date.now() - currentState.lastTransitionTime < this.MIN_TIME_BETWEEN_TRANSITIONS) {
                // Too soon for another transition
                currentState.consecutiveCount = 1;
                await this.setState(stateKey, currentState);
                return { isInside: currentState.isInside, transitionOccurred: false };
            }

            // Start counting consecutive readings in new state
            currentState.consecutiveCount = 1;
            await this.setState(stateKey, currentState);

            // Check if we've reached the threshold for state change
            if (currentState.consecutiveCount >= this.HYSTERESIS_THRESHOLD) {
                const newState: GeofenceState = {
                    isInside: isCurrentlyInside,
                    lastTransitionTime: Date.now(),
                    consecutiveCount: 1
                };
                await this.setState(stateKey, newState);
                return { isInside: isCurrentlyInside, transitionOccurred: true };
            }

            return { isInside: currentState.isInside, transitionOccurred: false };

        } catch (error) {
            console.error('Error in geofence hysteresis validation:', error);
            // In case of error, trust the current reading
            return { isInside: isCurrentlyInside, transitionOccurred: false };
        }
    }

    private async getState(key: string): Promise<GeofenceState | null> {
        const state = await this.redis.get(key);
        return state ? JSON.parse(state) : null;
    }

    private async setState(key: string, state: GeofenceState): Promise<void> {
        await this.redis.setex(key, this.STATE_TTL, JSON.stringify(state));
    }

    async clearState(userId: number, geofenceId: number): Promise<void> {
        const stateKey = `geofence:hysteresis:${userId}:${geofenceId}`;
        await this.redis.del(stateKey);
    }

    async getTransitionHistory(userId: number, geofenceId: number): Promise<GeofenceState | null> {
        const stateKey = `geofence:hysteresis:${userId}:${geofenceId}`;
        return this.getState(stateKey);
    }
} 