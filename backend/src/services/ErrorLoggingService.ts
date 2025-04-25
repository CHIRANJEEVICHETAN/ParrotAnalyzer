import { Redis } from 'ioredis';
import { pool } from '../config/database';
import { RedisManager } from './RedisManager';

interface ErrorLog {
    timestamp: string;
    service: string;
    errorType: string;
    message: string;
    userId?: number;
    metadata?: any;
    stackTrace?: string;
}

export class ErrorLoggingService {
    private redis: RedisManager;
    private readonly ERROR_TTL = 86400 * 7; // 7 days
    private readonly MAX_ERRORS_PER_USER = 1000;
    private readonly recoverableErrors = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'NETWORK_ERROR',
        'REDIS_NOT_CONNECTED',
        'DB_CONNECTION_ERROR',
        'LOCATION_VALIDATION_ERROR',
        'GEOFENCE_ERROR',
        'SHIFT_ERROR'
    ];

    constructor() {
        this.redis = new RedisManager(process.env.REDIS_URL || 'redis://localhost:6379');
    }

    /**
     * Logs an error to the database
     * @param error The error object
     * @param service The service where the error occurred
     * @param userId Optional user ID associated with the error
     * @param metadata Optional metadata about the error context
     */
    async logError(
        error: Error | any,
        service: string,
        userId?: number,
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            const errorType = error.code || error.name || 'UNKNOWN_ERROR';
            const message = error.message || 'An unknown error occurred';
            const stackTrace = error.stack || '';

            await pool.query(
                `INSERT INTO error_logs (
                    service,
                    error_type,
                    message,
                    user_id,
                    metadata,
                    stack_trace
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    service,
                    errorType,
                    message,
                    userId || null,
                    metadata ? JSON.stringify(metadata) : null,
                    stackTrace
                ]
            );

            // Cache in Redis for quick access
            if (userId) {
                await this.cacheUserError(userId, {
                    timestamp: new Date().toISOString(),
                    service,
                    errorType,
                    message,
                    userId,
                    metadata,
                    stackTrace
                });
            }

            // Console log for development
            console.error('Error logged:', {
                service,
                errorType,
                message,
                userId,
                timestamp: new Date().toISOString()
            });
        } catch (loggingError) {
            // If we can't log to the database, log to console as fallback
            console.error('Failed to log error to database:', loggingError);
            console.error('Original error:', {
                service,
                error,
                userId,
                metadata
            });
        }
    }

    private async cacheUserError(userId: number, errorLog: ErrorLog): Promise<void> {
        const key = `errors:user:${userId}`;

        try {
            // Convert error log to string for Redis storage
            const errorLogString = JSON.stringify(errorLog);
            
            // Get current list from Redis or create a new one
            let currentList: ErrorLog[] = [];
            const currentListStr = await this.redis.get(key);
            
            if (currentListStr) {
                try {
                    currentList = JSON.parse(currentListStr);
                    if (!Array.isArray(currentList)) {
                        currentList = [];
                    }
                } catch (e) {
                    console.error('Error parsing error log list from Redis:', e);
                    currentList = [];
                }
            }
            
            // Add new error to the list
            currentList.unshift(errorLog);
            
            // Trim list to prevent memory bloat
            if (currentList.length > this.MAX_ERRORS_PER_USER) {
                currentList = currentList.slice(0, this.MAX_ERRORS_PER_USER);
            }
            
            // Save updated list back to Redis
            await this.redis.set(key, JSON.stringify(currentList), this.ERROR_TTL);
        } catch (error) {
            console.error('Failed to cache error in Redis:', error);
            // Error handling already built into RedisManager
        }
    }

    /**
     * Checks if an error is recoverable based on predefined error codes
     * @param error The error to check
     * @returns boolean indicating if the error is recoverable
     */
    isRecoverableError(error: Error | any): boolean {
        return (
            (error.code && this.recoverableErrors.includes(error.code)) ||
            (error.message && this.recoverableErrors.some(e => error.message.includes(e)))
        );
    }

    /**
     * Retrieves error logs for a specific user within a time range
     * @param userId The user ID to get logs for
     * @param startDate Start of the time range
     * @param endDate End of the time range
     * @returns Array of error logs
     */
    async getUserErrors(
        userId: number,
        startDate: Date,
        endDate: Date
    ): Promise<any[]> {
        const result = await pool.query(
            `SELECT * FROM error_logs 
            WHERE user_id = $1 
            AND timestamp BETWEEN $2 AND $3 
            ORDER BY timestamp DESC`,
            [userId, startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Retrieves error logs for a specific service within a time range
     * @param service The service name to get logs for
     * @param startDate Start of the time range
     * @param endDate End of the time range
     * @returns Array of error logs
     */
    async getServiceErrors(
        service: string,
        startDate: Date,
        endDate: Date
    ): Promise<any[]> {
        const result = await pool.query(
            `SELECT * FROM error_logs 
            WHERE service = $1 
            AND timestamp BETWEEN $2 AND $3 
            ORDER BY timestamp DESC`,
            [service, startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Gets error frequency by type within a time range
     * @param startDate Start of the time range
     * @param endDate End of the time range
     * @returns Array of error frequencies by type
     */
    async getErrorFrequency(
        startDate: Date,
        endDate: Date
    ): Promise<any[]> {
        const result = await pool.query(
            `SELECT 
                error_type,
                COUNT(*) as frequency,
                MIN(timestamp) as first_occurrence,
                MAX(timestamp) as last_occurrence
            FROM error_logs 
            WHERE timestamp BETWEEN $1 AND $2 
            GROUP BY error_type 
            ORDER BY frequency DESC`,
            [startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Cleans up old error logs based on retention period
     * @param retentionDays Number of days to retain logs
     */
    async cleanupOldLogs(retentionDays: number = 30): Promise<void> {
        try {
            await pool.query(
                `DELETE FROM error_logs 
                WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'`
            );
        } catch (error) {
            console.error('Failed to cleanup old error logs:', error);
        }
    }
} 