import { pool } from '../config/database';
import { Redis } from 'ioredis';
import { Location } from '../types/liveTracking';
import { logLocationError } from "../utils/errorLogger";

export class TrackingAnalyticsService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  }

  async updateAnalytics(location: Location, userId: number): Promise<void> {
    try {
      const shiftId = await this.getCurrentShiftId(userId);

      // Only update metrics if we have valid data
      await Promise.all([
        this.updateDistanceMetrics(location, userId, shiftId || 0),
        this.updateTimeMetrics(location, userId, shiftId || 0),
        this.updateGeofenceMetrics(location, userId, shiftId || 0),
      ]);
    } catch (error) {
      console.error("Analytics update error:", error);
      // Log error properly using the error logger
      logLocationError(error, userId, location);
    }
  }

  private async getCurrentShiftId(userId: number): Promise<number | null> {
    const result = await pool.query(
      `SELECT id FROM employee_shifts 
             WHERE user_id = $1 
             AND start_time <= NOW() 
             AND (end_time IS NULL OR end_time >= NOW())
             AND status = 'active'
             LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.id || null;
  }

  private async updateDistanceMetrics(
    location: Location,
    userId: number,
    shiftId: number
  ): Promise<void> {
    const lastLocationKey = `last_location:${userId}`;

    try {
      // Get last location from Redis
      const lastLocationStr = await this.redis.get(lastLocationKey);
      let lastLocation: { latitude: number; longitude: number } | null = null;

      if (lastLocationStr) {
        try {
          lastLocation = JSON.parse(lastLocationStr);
        } catch (e) {
          console.error(`Error parsing last location for user ${userId}:`, e);
          // If parsing fails, clear the invalid data
          await this.redis.del(lastLocationKey);
        }
      }

      if (lastLocation?.latitude) {
        const distance = this.calculateDistance(
          lastLocation.latitude,
          lastLocation.longitude,
          location.latitude,
          location.longitude
        );

        if (distance > 0) {
          try {
            // Check if the analytics record exists for this user and shift
            const checkResult = await pool.query(
              `SELECT id FROM tracking_analytics 
               WHERE user_id = $1 AND date = CURRENT_DATE`,
              [userId]
            );

            if (checkResult.rows.length > 0) {
              // Update existing record
              await pool.query(
                `UPDATE tracking_analytics 
                 SET total_distance = total_distance + $1 
                 WHERE id = $2`,
                [distance, checkResult.rows[0].id]
              );
            } else {
              // Create new record
              await pool.query(
                `INSERT INTO tracking_analytics 
                 (user_id, date, total_distance, last_update) 
                 VALUES ($1, CURRENT_DATE, $2, NOW())`,
                [userId, distance]
              );
            }
          } catch (error) {
            console.error(
              `Error updating distance metrics for user ${userId}:`,
              error
            );
          }
        }
      }

      // Update last location in Redis as a JSON string
      await this.redis.set(
        lastLocationKey,
        JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: location.timestamp,
        }),
        "EX",
        86400 // 24 hours TTL
      );
    } catch (error) {
      console.error(
        `Error in updateDistanceMetrics for user ${userId}:`,
        error
      );
      // Log error properly using the error logger
      logLocationError(error, userId, location);
    }
  }

  private async updateTimeMetrics(
    location: Location,
    userId: number,
    shiftId: number
  ): Promise<void> {
    const isIndoors = await this.checkIfIndoors(location);
    const timeField = isIndoors ? "indoor_time" : "outdoor_time";

    try {
      // Check if analytics record exists
      const checkResult = await pool.query(
        `SELECT id, last_update FROM tracking_analytics 
                 WHERE user_id = $1 AND date = CURRENT_DATE`,
        [userId]
      );

      if (checkResult.rows.length > 0) {
        // Update existing record with time increment
        const lastUpdate = checkResult.rows[0].last_update || new Date();
        const timeIncrement = Math.floor(
          (new Date().getTime() - new Date(lastUpdate).getTime()) / 1000
        );

        await pool.query(
          `UPDATE tracking_analytics 
                     SET ${timeField} = ${timeField} + $1, 
                     last_update = NOW() 
                     WHERE id = $2`,
          [timeIncrement, checkResult.rows[0].id]
        );
      } else {
        // Create new record
        const initialFields = {
          indoor_time: isIndoors ? 30 : 0, // Initial 30 seconds if indoors
          outdoor_time: isIndoors ? 0 : 30, // Initial 30 seconds if outdoors
        };

        await pool.query(
          `INSERT INTO tracking_analytics 
                     (user_id, date, indoor_time, outdoor_time, last_update) 
                     VALUES ($1, CURRENT_DATE, $2, $3, NOW())`,
          [userId, initialFields.indoor_time, initialFields.outdoor_time]
        );
      }
    } catch (error) {
      console.error(`Error updating time metrics for user ${userId}:`, error);
      // Continue execution despite error
    }
  }

  private async updateGeofenceMetrics(
    location: Location,
    userId: number,
    shiftId: number
  ): Promise<void> {
    const result = await pool.query(
      `SELECT cg.id, ST_DWithin(
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                coordinates::geography,
                radius
             ) as is_inside
             FROM company_geofences cg
             JOIN users u ON u.company_id = cg.company_id
             WHERE u.id = $3`,
      [location.longitude, location.latitude, userId]
    );

    for (const geofence of result.rows) {
      const geofenceKey = `geofence:${userId}:${geofence.id}`;
      const wasInside = (await this.redis.get(geofenceKey)) === "1";

      if (geofence.is_inside) {
        if (!wasInside) {
          await this.redis.set(geofenceKey, "1");
          await this.logGeofenceEntry(userId, geofence.id, shiftId);
        }
      } else if (wasInside) {
        await this.redis.set(geofenceKey, "0");
        await this.logGeofenceExit(userId, geofence.id, shiftId);
      }
    }
  }

  private async checkIfIndoors(location: Location): Promise<boolean> {
    // Basic indoor detection based on accuracy and speed
    return (location.accuracy ?? 0) > 20 || (location.speed ?? 0) < 0.5;
  }

  private async logGeofenceEntry(
    userId: number,
    geofenceId: number,
    shiftId: number
  ): Promise<void> {
    if (!shiftId) {
      console.error(
        `No shift found for user ${userId} when logging geofence entry for geofence ${geofenceId}`
      );
      return;
    }

    await pool.query(
      `INSERT INTO geofence_events (user_id, geofence_id, shift_id, event_type, timestamp)
             VALUES ($1, $2, $3, 'entry', NOW())`,
      [userId, geofenceId, shiftId]
    );
  }

  private async logGeofenceExit(
    userId: number,
    geofenceId: number,
    shiftId: number
  ): Promise<void> {
    if (!shiftId) {
      console.error(
        `No shift found for user ${userId} when logging geofence exit for geofence ${geofenceId}`
      );
      return;
    }

    await pool.query(
      `INSERT INTO geofence_events (user_id, geofence_id, shift_id, event_type, timestamp)
             VALUES ($1, $2, $3, 'exit', NOW())`,
      [userId, geofenceId, shiftId]
    );
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
} 