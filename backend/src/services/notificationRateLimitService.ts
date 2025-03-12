import { pool } from "../config/database";

interface RateLimit {
  id: number;
  user_id: number;
  notification_type: string;
  count: number;
  window_start: Date;
  window_end: Date;
}

class NotificationRateLimitService {
  private readonly DEFAULT_LIMITS = {
    general: { count: 10, window: 3600 }, // 10 per hour
    announcement: { count: 5, window: 3600 }, // 5 per hour
    task: { count: 20, window: 3600 }, // 20 per hour
    group: { count: 15, window: 3600 }, // 15 per hour
  };

  async checkRateLimit(
    userId: number,
    notificationType: string,
    customLimit?: { count: number; window: number }
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      // Get or create rate limit record
      const limit =
        customLimit ||
        this.DEFAULT_LIMITS[
          notificationType as keyof typeof this.DEFAULT_LIMITS
        ] ||
        this.DEFAULT_LIMITS.general;
      const windowSize = limit.window;

      // Clean up expired rate limits
      await this.cleanupExpiredLimits();

      // Get current rate limit record
      const result = await client.query(
        `SELECT * FROM notification_rate_limits 
         WHERE user_id = $1 
         AND notification_type = $2 
         AND window_end > NOW()`,
        [userId, notificationType]
      );

      if (result.rows.length === 0) {
        // Create new rate limit record
        await client.query(
          `INSERT INTO notification_rate_limits 
           (user_id, notification_type, count, window_start, window_end) 
           VALUES ($1, $2, 1, NOW(), NOW() + INTERVAL '1 second' * $3)`,
          [userId, notificationType, windowSize]
        );
        return true;
      }

      const rateLimit = result.rows[0] as RateLimit;
      if (rateLimit.count >= limit.count) {
        return false;
      }

      // Increment count
      await client.query(
        `UPDATE notification_rate_limits 
         SET count = count + 1 
         WHERE id = $1`,
        [rateLimit.id]
      );

      return true;
    } finally {
      client.release();
    }
  }

  private async cleanupExpiredLimits() {
    const client = await pool.connect();
    try {
      await client.query(
        `DELETE FROM notification_rate_limits 
         WHERE window_end <= NOW()`
      );
    } finally {
      client.release();
    }
  }

  async getRateLimitStatus(
    userId: number,
    notificationType: string
  ): Promise<{
    remaining: number;
    reset: Date;
    limit: number;
  }> {
    const client = await pool.connect();
    try {
      const limit =
        this.DEFAULT_LIMITS[
          notificationType as keyof typeof this.DEFAULT_LIMITS
        ] || this.DEFAULT_LIMITS.general;

      const result = await client.query(
        `SELECT * FROM notification_rate_limits 
         WHERE user_id = $1 
         AND notification_type = $2 
         AND window_end > NOW()`,
        [userId, notificationType]
      );

      if (result.rows.length === 0) {
        return {
          remaining: limit.count,
          reset: new Date(Date.now() + limit.window * 1000),
          limit: limit.count,
        };
      }

      const rateLimit = result.rows[0] as RateLimit;
      return {
        remaining: Math.max(0, limit.count - rateLimit.count),
        reset: rateLimit.window_end,
        limit: limit.count,
      };
    } finally {
      client.release();
    }
  }

  async updateRateLimits(
    notificationType: string,
    newLimit: { count: number; window: number }
  ) {
    if (notificationType in this.DEFAULT_LIMITS) {
      this.DEFAULT_LIMITS[
        notificationType as keyof typeof this.DEFAULT_LIMITS
      ] = newLimit;
    }
  }

  async getUserRateLimits(userId: number) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
           notification_type,
           count,
           window_start,
           window_end,
           EXTRACT(EPOCH FROM (window_end - NOW())) as seconds_remaining
         FROM notification_rate_limits 
         WHERE user_id = $1 
         AND window_end > NOW()`,
        [userId]
      );

      return result.rows.map((row) => ({
        type: row.notification_type,
        used: row.count,
        limit:
          this.DEFAULT_LIMITS[
            row.notification_type as keyof typeof this.DEFAULT_LIMITS
          ]?.count || this.DEFAULT_LIMITS.general.count,
        windowStart: row.window_start,
        windowEnd: row.window_end,
        secondsRemaining: Math.max(0, row.seconds_remaining),
      }));
    } finally {
      client.release();
    }
  }

  async resetUserRateLimits(userId: number) {
    const client = await pool.connect();
    try {
      await client.query(
        `DELETE FROM notification_rate_limits 
         WHERE user_id = $1`,
        [userId]
      );
    } finally {
      client.release();
    }
  }
}

export default new NotificationRateLimitService();
