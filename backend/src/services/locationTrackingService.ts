import { pool } from "../config/database";
import { Redis } from "ioredis";
import { calculateDistance } from "../utils/geoUtils";
import { logLocationError, logGeofenceError } from "../utils/errorLogger";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

/**
 * Service for handling location tracking operations
 */
export class LocationTrackingService {
  /**
   * Store a location update in the database and update related tables
   */
  async storeLocationUpdate(
    userId: number,
    shiftId: number | null,
    location: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp?: string;
      battery_level?: number;
      is_moving?: boolean;
      altitude?: number;
      speed?: number;
      is_tracking_active?: boolean;
      isBackgroundUpdate?: boolean;
    }
  ) {
    try {
      // Validate the location data before proceeding
      if (
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number" ||
        isNaN(location.latitude) ||
        isNaN(location.longitude)
      ) {
        throw new Error(
          `Invalid coordinates: lat=${location.latitude}, lng=${location.longitude}`
        );
      }

      // Ensure numeric fields are properly typed
      const sanitizedLocation = {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        accuracy:
          location.accuracy !== undefined ? Number(location.accuracy) : null,
        battery_level:
          location.battery_level !== undefined
            ? Number(location.battery_level)
            : null,
        is_moving: Boolean(location.is_moving),
        is_tracking_active: Boolean(location.is_tracking_active),
        timestamp: location.timestamp || new Date().toISOString(),
        isBackgroundUpdate: Boolean(location.isBackgroundUpdate),
      };

      console.log(
        `Storing location for user ${userId}: ${JSON.stringify(
          sanitizedLocation
        )}`
      );

      // If no shift ID was provided, check if there's an active shift
      if (!shiftId) {
        const activeShiftResult = await pool.query(
          `SELECT employee_shifts.id FROM employee_shifts 
           WHERE employee_shifts.user_id = $1 AND employee_shifts.end_time IS NULL
           ORDER BY employee_shifts.start_time DESC LIMIT 1`,
          [userId]
        );

        if (activeShiftResult.rows.length > 0) {
          console.log(
            `Found active shift ${activeShiftResult.rows[0].id} for user ${userId}`
          );
          shiftId = activeShiftResult.rows[0].id;
        }
      }

      // Insert location into employee_locations table
      const result = await pool.query(
        `INSERT INTO employee_locations 
        (user_id, shift_id, latitude, longitude, accuracy, is_moving, battery_level, timestamp, is_tracking_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING employee_locations.id`,
        [
          userId,
          shiftId,
          sanitizedLocation.latitude,
          sanitizedLocation.longitude,
          sanitizedLocation.accuracy,
          sanitizedLocation.is_moving,
          sanitizedLocation.battery_level,
          sanitizedLocation.timestamp,
          sanitizedLocation.is_tracking_active,
        ]
      );

      const locationId = result.rows[0].id;

      // Cache the latest location in Redis for quick access
      // First, get comprehensive employee details
      const employeeResult = await pool.query(
        `SELECT u.id, u.name, u.employee_number, u.department, u.designation 
         FROM users u
         WHERE u.id = $1`,
        [userId]
      );

      // Get device info for the employee
      const deviceResult = await pool.query(
        `SELECT device_tokens.device_type, device_tokens.device_name
         FROM device_tokens
         WHERE device_tokens.user_id = $1
         AND device_tokens.is_active = true
         ORDER BY device_tokens.last_used_at DESC
         LIMIT 1`,
        [userId]
      );

      const deviceInfo =
        deviceResult.rows.length > 0
          ? `${deviceResult.rows[0].device_name || ""} (${
              deviceResult.rows[0].device_type || "unknown"
            })`
          : "Unknown device";

      // Prepare the location data with employee details for caching
      const cacheData = {
        ...sanitizedLocation,
        lastUpdated: new Date().toISOString(),
        employee:
          employeeResult.rows.length > 0
            ? {
                id: userId,
                name: employeeResult.rows[0].name,
                employeeNumber: employeeResult.rows[0].employee_number,
                department: employeeResult.rows[0].department,
                designation: employeeResult.rows[0].designation,
                deviceInfo,
              }
            : null,
      };

      await redis.set(
        `location:${userId}`,
        JSON.stringify(cacheData),
        "EX",
        300 // Expire after 5 minutes
      );

      // If this is part of an active shift, update the shift's location history
      if (shiftId) {
        await this.updateShiftLocationHistory(
          userId,
          shiftId,
          sanitizedLocation
        );
      }

      // Check if the location is within any geofence and record transitions
      await this.checkGeofenceTransitions(userId, shiftId, {
        latitude: sanitizedLocation.latitude,
        longitude: sanitizedLocation.longitude,
      });

      return locationId;
    } catch (error) {
      console.error("Error storing location:", error);
      logLocationError(error, userId, location);
      throw error;
    }
  }

  /**
   * Update the location_history field of an employee_shift
   */
  async updateShiftLocationHistory(
    userId: number,
    shiftId: number,
    location: {
      latitude: number;
      longitude: number;
      timestamp?: string;
    }
  ) {
    try {
      // First check if the shift exists and get current history
      const shiftResult = await pool.query(
        `SELECT location_history FROM employee_shifts WHERE id = $1`,
        [shiftId]
      );

      if (shiftResult.rows.length === 0) {
        console.warn(`No shift found with ID ${shiftId}`);
        return;
      }

      const currentHistory = shiftResult.rows[0].location_history;
      let updatedHistory;

      if (!currentHistory) {
        // If no history exists, create a new LineString with this point
        updatedHistory = {
          type: "LineString",
          coordinates: [[location.longitude, location.latitude]],
        };
      } else {
        try {
          // Try to parse as JSON first
          let historyGeoJson;

          if (typeof currentHistory === "string") {
            historyGeoJson = JSON.parse(currentHistory);
          } else if (typeof currentHistory === "object") {
            // Already an object, use directly
            historyGeoJson = currentHistory;
          } else {
            // Create new GeoJSON if we can't parse existing one
            console.log(
              "Creating new GeoJSON object for history - could not parse existing data"
            );
            historyGeoJson = {
              type: "LineString",
              coordinates: [],
            };
          }

          // Ensure the coordinates property exists
          if (!historyGeoJson.coordinates) {
            historyGeoJson.coordinates = [];
          }

          // Add the new point to the existing LineString
          historyGeoJson.coordinates.push([
            location.longitude,
            location.latitude,
          ]);
          updatedHistory = historyGeoJson;
        } catch (parseError) {
          console.warn(
            "Error parsing location history, creating new GeoJSON:",
            parseError
          );
          // If parsing fails, create a new GeoJSON object
          updatedHistory = {
            type: "LineString",
            coordinates: [[location.longitude, location.latitude]],
          };
        }
      }

      // Update the shift with the new location history
      await pool.query(
        `UPDATE employee_shifts 
         SET location_history = ST_GeomFromGeoJSON($1),
             last_location_update = $2
         WHERE id = $3`,
        [JSON.stringify(updatedHistory), new Date(), shiftId]
      );

      // Calculate and update distance if necessary
      await this.updateShiftDistance(shiftId);
    } catch (error) {
      console.error("Error updating shift location history:", error);
      // Log the error but don't throw it to avoid crashing the location update process
      return;
    }
  }

  /**
   * Calculate and update the total distance for a shift
   */
  async updateShiftDistance(shiftId: number) {
    try {
      // Calculate the total distance using PostGIS
      const result = await pool.query(
        `UPDATE employee_shifts 
         SET total_distance_km = ST_Length(location_history::geography)/1000
         WHERE id = $1
         RETURNING total_distance_km`,
        [shiftId]
      );

      return result.rows[0]?.total_distance_km || 0;
    } catch (error) {
      console.error("Error updating shift distance:", error);
      throw error;
    }
  }

  /**
   * Update the travel time for a shift
   */
  async updateShiftTravelTime(shiftId: number) {
    try {
      // Calculate the travel time in minutes
      const result = await pool.query(
        `UPDATE employee_shifts 
         SET travel_time_minutes = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))/60
         WHERE id = $1
         RETURNING travel_time_minutes`,
        [shiftId]
      );

      return result.rows[0]?.travel_time_minutes || 0;
    } catch (error) {
      console.error("Error updating travel time:", error);
      throw error;
    }
  }

  /**
   * Check if the location is within any geofence and record transitions
   */
  async checkGeofenceTransitions(
    userId: number,
    shiftId: number | null,
    location: {
      latitude: number;
      longitude: number;
    }
  ) {
    try {
      // Validate coordinates to ensure they are numbers
      if (
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number" ||
        isNaN(location.latitude) ||
        isNaN(location.longitude)
      ) {
        console.error("Invalid coordinates for geofence check:", location);
        return {
          isInGeofence: false,
          geofenceId: null,
          geofenceName: null,
          error: "Invalid coordinates",
        };
      }

      console.log(
        `Checking geofence for user ${userId} at coordinates: ${location.longitude}, ${location.latitude}`
      );

      // Get user's company ID
      const userResult = await pool.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        console.warn(`No user found with ID ${userId}`);
        return;
      }

      const companyId = userResult.rows[0].company_id;

      // Check if location is inside any geofence - with explicit type casting to be safe
      const result = await pool.query(
        `SELECT id, name FROM company_geofences 
         WHERE company_id = $1
         AND ST_DWithin(
           coordinates, 
           ST_SetSRID(ST_MakePoint($2::float, $3::float), 4326), 
           radius
         )`,
        [companyId, location.longitude, location.latitude]
      );

      const isInGeofence = result.rows.length > 0;
      const geofenceId = isInGeofence ? result.rows[0].id : null;

      // Get previous status from Redis
      const prevStatusKey = `geofence:${userId}`;
      const prevStatus = await redis.get(prevStatusKey);
      const previousGeofenceId = prevStatus
        ? JSON.parse(prevStatus).geofenceId
        : null;

      // If there's a transition, record it
      if (geofenceId !== previousGeofenceId && shiftId) {
        // Determine event type
        const eventType = geofenceId ? "entry" : "exit";

        // Record the transition
        if (
          eventType === "entry" ||
          (eventType === "exit" && previousGeofenceId)
        ) {
          await pool.query(
            `INSERT INTO geofence_events 
             (user_id, geofence_id, shift_id, event_type, timestamp)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [
              userId,
              eventType === "entry" ? geofenceId : previousGeofenceId,
              shiftId,
              eventType,
            ]
          );
        }
      }

      // Update location record with geofence status
      await pool.query(
        `UPDATE employee_locations 
         SET geofence_status = $1
         WHERE id = (
           SELECT id FROM employee_locations 
           WHERE user_id = $2
           ORDER BY timestamp DESC
           LIMIT 1
         )`,
        [isInGeofence ? "inside" : "outside", userId]
      );

      // Update Redis with new status
      await redis.set(
        prevStatusKey,
        JSON.stringify({
          isInGeofence,
          geofenceId,
          timestamp: new Date().toISOString(),
        }),
        "EX",
        300 // Expire after 5 minutes
      );

      return {
        isInGeofence,
        geofenceId,
        geofenceName: isInGeofence ? result.rows[0].name : null,
      };
    } catch (error) {
      console.error("Error checking geofence transitions:", error);
      logGeofenceError(error, userId, location);
      throw error;
    }
  }

  /**
   * Generate daily tracking analytics for a user
   */
  async generateDailyAnalytics(userId: number, date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split("T")[0];

      // Calculate total distance from all shifts on the specified date
      const distanceResult = await pool.query(
        `SELECT SUM(total_distance_km) as total_distance
         FROM employee_shifts
         WHERE user_id = $1
         AND DATE(start_time) = $2`,
        [userId, targetDate]
      );

      // Calculate total travel time
      const timeResult = await pool.query(
        `SELECT SUM(travel_time_minutes) as total_time
         FROM employee_shifts
         WHERE user_id = $1
         AND DATE(start_time) = $2`,
        [userId, targetDate]
      );

      // Calculate indoor/outdoor time
      const locationResult = await pool.query(
        `SELECT 
           SUM(CASE WHEN is_outdoor = true THEN 1 ELSE 0 END) as outdoor_count,
           COUNT(*) as total_count
         FROM employee_locations
         WHERE user_id = $1
         AND DATE(timestamp) = $2`,
        [userId, targetDate]
      );

      const totalDistance = distanceResult.rows[0]?.total_distance || 0;
      const totalTime = timeResult.rows[0]?.total_time || 0;

      const totalCount = locationResult.rows[0]?.total_count || 0;
      const outdoorCount = locationResult.rows[0]?.outdoor_count || 0;

      // Estimate indoor/outdoor time based on location count proportions
      const outdoorTimeMinutes =
        totalCount > 0
          ? Math.round((outdoorCount / totalCount) * totalTime)
          : 0;

      const indoorTimeMinutes = totalTime - outdoorTimeMinutes;

      // Insert or update analytics for the day
      await pool.query(
        `INSERT INTO tracking_analytics
         (user_id, date, total_distance_km, total_travel_time_minutes, 
          outdoor_time_minutes, indoor_time_minutes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, date)
         DO UPDATE SET
           total_distance_km = $3,
           total_travel_time_minutes = $4,
           outdoor_time_minutes = $5,
           indoor_time_minutes = $6,
           created_at = CURRENT_TIMESTAMP`,
        [
          userId,
          targetDate,
          totalDistance,
          totalTime,
          outdoorTimeMinutes,
          indoorTimeMinutes,
        ]
      );

      return {
        date: targetDate,
        totalDistanceKm: totalDistance,
        totalTravelTimeMinutes: totalTime,
        outdoorTimeMinutes: outdoorTimeMinutes,
        indoorTimeMinutes: indoorTimeMinutes,
      };
    } catch (error) {
      console.error("Error generating analytics:", error);
      throw error;
    }
  }
}

export default new LocationTrackingService();
