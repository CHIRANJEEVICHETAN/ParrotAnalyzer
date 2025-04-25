import { Request as ExpressRequest, Response } from "express";
import locationTrackingService from "../services/locationTrackingService";
import { pool } from "../config/database";
import Redis from "ioredis";
import { GroupAdminTrackingService } from "../services/GroupAdminTrackingService";
import { User } from "../types/user";

// Define a Request type that includes the user property
interface Request extends ExpressRequest {
  user?: User;
}

/**
 * Controller for handling employee location tracking endpoints
 */
export class LocationTrackingController {
  /**
   * Store a location update
   */
  async storeLocation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const location = req.body;

      // Check if this is a background update
      const isBackgroundUpdate =
        !!location.isBackground ||
        req.headers['x-background-update'] === 'true';

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Additional logging for background updates
      if (isBackgroundUpdate) {
        console.log(`Received background location update from user ${userId}`);
      }

      // Find active shift if not provided
      let shiftId = location.shiftId || null;
      if (!shiftId) {
        // Look for active shift
        const activeShift = await pool.query(
          `SELECT id FROM employee_shifts
           WHERE user_id = $1
           AND end_time IS NULL
           ORDER BY start_time DESC LIMIT 1`,
          [userId]
        );

        if (activeShift.rows.length > 0) {
          shiftId = activeShift.rows[0].id;
          console.log(`Found active shift ${shiftId} for user ${userId}`);
        }
      }

      // Store the location
      try {
        const locationId = await locationTrackingService.storeLocationUpdate(
          userId,
          shiftId,
          {
            ...location,
            isBackgroundUpdate,
          }
        );

        res.status(200).json({
          success: true,
          locationId,
          timestamp: new Date(),
        });
      } catch (storageError: any) {
        console.error("Location storage error:", storageError.message);
        
        // Still return success to prevent client retry loops
        // But include error message for debugging
        res.status(200).json({
          success: false,
          error: storageError.message,
          errorCode: "LOCATION_STORAGE_ERROR",
          timestamp: new Date(),
        });
      }
    } catch (error: any) {
      console.error("Error in storeLocation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to store location",
        error: error.message,
      });
    }
  }

  /**
   * Store a background location update with more forgiving validation
   */
  async storeBackgroundLocation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const location = req.body;

      // Mark explicitly as a background update
      const isBackgroundUpdate = true;

      // Log received location data for debugging
      console.log("Received background location data:", {
        userId,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp,
        trackingStatus: location.trackingStatus || "inactive",
        accuracy: location.accuracy,
        batteryLevel: location.batteryLevel,
      });

      // Basic validation - we're more forgiving for background updates
      if (
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number" ||
        isNaN(location.latitude) ||
        isNaN(location.longitude)
      ) {
        console.error(
          `Invalid background location coordinates for user ${userId}:`,
          {
            latitude: location.latitude,
            longitude: location.longitude,
          }
        );
        return res.status(200).json({
          success: false,
          message: "Invalid location coordinates, but acknowledged",
        });
      }

      // Check for active shift
      const shiftResult = await pool.query(
        `SELECT employee_shifts.id FROM employee_shifts 
         WHERE employee_shifts.user_id = $1 AND employee_shifts.end_time IS NULL
         ORDER BY employee_shifts.start_time DESC LIMIT 1`,
        [userId]
      );

      const shiftId =
        shiftResult.rows.length > 0 ? shiftResult.rows[0].id : null;

      // Default to inactive unless explicitly set
      const isTrackingActive =
        location.trackingStatus === "ACTIVE" ||
        location.is_tracking_active === true;

      try {
        // Store the location with tracking status - using a try/catch
        // to handle any issues without failing the request
        const locationId = await locationTrackingService.storeLocationUpdate(
          userId || 0,
          shiftId,
          {
            ...location,
            is_tracking_active: isTrackingActive,
            isBackgroundUpdate: true,
          }
        );

        // Update shift's last_location_update if there's an active shift
        if (shiftId) {
          await pool.query(
            `UPDATE employee_shifts 
             SET last_location_update = $1,
                 is_tracking_active = $2
             WHERE id = $3`,
            [new Date(), isTrackingActive, shiftId]
          );
        }

        // Always return 200 status for background updates to prevent retries
        res.status(200).json({
          success: true,
          locationId,
          shiftId,
          isTrackingActive,
        });
      } catch (storeError) {
        console.error("Error storing background location:", storeError);

        // Still return 200 status to prevent retry cycles in the app
        res.status(200).json({
          success: false,
          message: "Failed to store background location, but acknowledged",
          error:
            storeError instanceof Error
              ? storeError.message
              : String(storeError),
        });
      }
    } catch (error) {
      console.error("Error in background location tracking:", error);

      // Always return 200 for background updates to prevent mobile app retries
      res.status(200).json({
        success: false,
        message: "Failed to process background location, but acknowledged",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start a shift
   */
  async startShift(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const {
        latitude,
        longitude,
        accuracy,
        timestamp,
        batteryLevel,
        speed,
        isMoving,
        altitude,
      } = req.body;

      // Check if user already has an active shift
      const activeShiftResult = await pool.query(
        `SELECT id FROM employee_shifts 
         WHERE user_id = $1 AND end_time IS NULL`,
        [userId]
      );

      if (activeShiftResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "User already has an active shift",
        });
      }

      // Create a new shift
      const shiftResult = await pool.query(
        `INSERT INTO employee_shifts 
         (user_id, start_time, start_latitude, start_longitude, start_accuracy, 
          last_location_update, battery_level, movement_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, start_time as startTimestamp`,
        [
          userId,
          timestamp || new Date(),
          latitude,
          longitude,
          accuracy,
          new Date(),
          batteryLevel,
          isMoving ? "moving" : "stationary",
        ]
      );

      const shiftId = shiftResult.rows[0].id;

      // Create initial location history as a LineString with a single point
      const locationHistory = {
        type: "LineString",
        coordinates: [[longitude, latitude]],
      };

      // Update the shift with the GeoJSON
      await pool.query(
        `UPDATE employee_shifts 
         SET location_history = ST_GeomFromGeoJSON($1)
         WHERE id = $2`,
        [JSON.stringify(locationHistory), shiftId]
      );

      // Store the starting location
      await locationTrackingService.storeLocationUpdate(userId || 0, shiftId, {
        latitude,
        longitude,
        accuracy,
        timestamp: timestamp || new Date().toISOString(),
        battery_level: batteryLevel,
        is_moving: isMoving,
        altitude,
        speed,
      });

      // Check if the location is in any geofence
      const geofenceStatus =
        await locationTrackingService.checkGeofenceTransitions(
          userId || 0,
          shiftId,
          { latitude, longitude }
        );

      res.status(200).json({
        success: true,
        id: shiftId,
        startTimestamp: shiftResult.rows[0].startTimestamp,
        geofenceStatus,
      });
    } catch (error) {
      console.error("Error starting shift:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start shift",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * End a shift
   */
  async endShift(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const {
        latitude,
        longitude,
        accuracy,
        timestamp,
        batteryLevel,
        speed,
        isMoving,
        altitude,
      } = req.body;

      // Get the active shift
      const activeShiftResult = await pool.query(
        `SELECT id, start_time FROM employee_shifts 
         WHERE user_id = $1 AND end_time IS NULL
         ORDER BY start_time DESC LIMIT 1`,
        [userId]
      );

      if (activeShiftResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No active shift found",
        });
      }

      const shiftId = activeShiftResult.rows[0].id;
      const startTime = activeShiftResult.rows[0].start_time;

      // Store the final location
      await locationTrackingService.storeLocationUpdate(userId || 0, shiftId, {
        latitude,
        longitude,
        accuracy,
        timestamp: timestamp || new Date().toISOString(),
        battery_level: batteryLevel,
        is_moving: isMoving,
        altitude,
        speed,
      });

      // Calculate total distance
      await locationTrackingService.updateShiftDistance(shiftId);

      // End the shift
      const endTime = timestamp ? new Date(timestamp) : new Date();
      const durationMinutes = Math.round(
        (endTime.getTime() - new Date(startTime).getTime()) / 60000
      );

      await pool.query(
        `UPDATE employee_shifts 
         SET end_time = $1, 
             end_latitude = $2, 
             end_longitude = $3, 
             end_accuracy = $4,
             travel_time_minutes = $5,
             last_location_update = $1
         WHERE id = $6`,
        [endTime, latitude, longitude, accuracy, durationMinutes, shiftId]
      );

      // Get the updated shift with calculated distance
      const updatedShiftResult = await pool.query(
        `SELECT 
           id, 
           start_time as "startTimestamp", 
           end_time as "endTimestamp", 
           total_distance_km as "totalDistance",
           travel_time_minutes as "travelTimeMinutes"
         FROM employee_shifts 
         WHERE id = $1`,
        [shiftId]
      );

      const shiftData = updatedShiftResult.rows[0];

      // Generate analytics for the day
      const today = new Date().toISOString().split("T")[0];
      await locationTrackingService.generateDailyAnalytics(userId || 0, today);

      res.status(200).json({
        success: true,
        ...shiftData,
      });
    } catch (error) {
      console.error("Error ending shift:", error);
      res.status(500).json({
        success: false,
        message: "Failed to end shift",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get current shift status
   */
  async getCurrentShift(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      const result = await pool.query(
        `SELECT 
           id, 
           start_time as "startTimestamp", 
           start_latitude as "startLatitude", 
           start_longitude as "startLongitude",
           total_distance_km as "totalDistance",
           travel_time_minutes as "travelTimeMinutes"
         FROM employee_shifts 
         WHERE user_id = $1 AND end_time IS NULL
         ORDER BY start_time DESC LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(200).json({
          success: true,
          isActive: false,
          message: "No active shift",
        });
      }

      // Get the most recent location for this shift
      const locationResult = await pool.query(
        `SELECT 
           latitude, 
           longitude, 
           accuracy, 
           battery_level as "batteryLevel",
           timestamp
         FROM employee_locations 
         WHERE user_id = $1 AND shift_id = $2
         ORDER BY timestamp DESC LIMIT 1`,
        [userId, result.rows[0].id]
      );

      const currentLocation =
        locationResult.rows.length > 0 ? locationResult.rows[0] : null;

      res.status(200).json({
        success: true,
        isActive: true,
        ...result.rows[0],
        currentLocation,
      });
    } catch (error) {
      console.error("Error getting current shift:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get current shift",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get shift history for employee
   */
  async getShiftHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { start_date, end_date } = req.query;

      // Validate date parameters
      const startDate = start_date
        ? new Date(start_date as string)
        : new Date();
      startDate.setDate(startDate.getDate() - 30); // Default to last 30 days

      const endDate = end_date ? new Date(end_date as string) : new Date();

      const result = await pool.query(
        `SELECT 
           id, 
           start_time as "startTimestamp", 
           end_time as "endTimestamp",
           total_distance_km as "totalDistance",
           travel_time_minutes as "travelTimeMinutes"
         FROM employee_shifts 
         WHERE user_id = $1 
         AND start_time BETWEEN $2 AND $3
         ORDER BY start_time DESC`,
        [userId, startDate, endDate]
      );

      // Format the results
      const shifts = result.rows.map((shift) => ({
        ...shift,
        duration: shift.endTimestamp
          ? Math.round(
              (new Date(shift.endTimestamp).getTime() -
                new Date(shift.startTimestamp).getTime()) /
                60000
            )
          : null,
        date: new Date(shift.startTimestamp).toISOString().split("T")[0],
      }));

      res.status(200).json({
        success: true,
        shifts,
      });
    } catch (error) {
      console.error("Error getting shift history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get shift history",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get active employee locations for a group admin
   */
  async getActiveEmployeeLocations(req: Request, res: Response) {
    try {
      const groupAdminId = req.user?.id;
      console.log(
        `[Controller] Getting active employee locations for group admin ${groupAdminId}`
      );

      // First try the service that uses Redis
      try {
        const groupAdminService = new GroupAdminTrackingService();
        const locations = await groupAdminService.getActiveEmployeeLocations(
          groupAdminId || 0
        );

        if (locations && locations.length > 0) {
          console.log(
            `[Controller] Found ${locations.length} employee locations via GroupAdminTrackingService`
          );
          return res.json(locations);
        } else {
          console.log(
            `[Controller] No locations found via GroupAdminTrackingService, falling back to direct DB query`
          );
        }
      } catch (serviceError) {
        console.error(
          "[Controller] Error using GroupAdminTrackingService:",
          serviceError
        );
      }

      // Fallback to direct database query if Redis fails or returns empty
      console.log(
        `[Controller] Performing fallback database query for employee locations`
      );

      // Get all employees assigned to this group admin
      const employeesResult = await pool.query(
        `SELECT u.id, u.name, u.email, u.employee_number, u.department, u.designation 
         FROM users u
         WHERE (u.group_admin_id = $1 OR u.manager_id = $1)
         AND u.is_active = true
         AND u.role = 'employee'`,
        [groupAdminId]
      );

      if (employeesResult.rows.length === 0) {
        console.log(
          `[Controller] No employees found for group admin ${groupAdminId}`
        );
        return res.json([]);
      }

      console.log(
        `[Controller] Found ${employeesResult.rows.length} employees assigned to group admin ${groupAdminId}`
      );

      // For each employee, get their most recent location
      const employeeLocations = await Promise.all(
        employeesResult.rows.map(async (employee) => {
          try {
            const locationResult = await pool.query(
              `SELECT id, latitude, longitude, accuracy, timestamp, battery_level, is_moving
               FROM employee_locations
               WHERE user_id = $1
               ORDER BY timestamp DESC
               LIMIT 1`,
              [employee.id]
            );

            // Get device info for this employee
            const deviceResult = await pool.query(
              `SELECT device_type, device_name
               FROM device_tokens 
               WHERE user_id = $1 AND is_active = true
               ORDER BY updated_at DESC 
               LIMIT 1`,
              [employee.id]
            );

            const deviceInfo =
              deviceResult.rows.length > 0
                ? deviceResult.rows[0].device_name
                : "Unknown device";

            if (locationResult.rows.length === 0) {
              console.log(
                `[Controller] No location found for employee ${employee.id}`
              );
              return null;
            }

            const location = locationResult.rows[0];
            console.log(
              `[Controller] Found location for employee ${employee.id} from database`
            );

            // Store this location in Redis for future use
            const locationData = {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              timestamp: location.timestamp,
              batteryLevel: location.battery_level,
              isMoving: location.is_moving,
              lastUpdated: new Date().toISOString(),
            };

            // Push to Redis with multiple key formats
            const redis = new Redis(
              process.env.REDIS_URL || "redis://localhost:6379"
            );
            const keyFormats = [
              `last_location:${employee.id}`,
              `location:${employee.id}`,
              `employee:location:${employee.id}`,
              `user:${employee.id}:location`,
            ];

            for (const key of keyFormats) {
              await redis.set(key, JSON.stringify(locationData));
            }

            // Create employee label using name and employee number if available
            const employeeLabel = employee.employee_number
              ? `${employee.name} (${employee.employee_number})`
              : employee.name;

            return {
              employee: {
                id: employee.id,
                name: employee.name,
                email: employee.email,
                employeeNumber: employee.employee_number,
                designation: employee.designation,
                department: employee.department,
                deviceInfo: deviceInfo,
              },
              ...locationData,
              source: "database_fallback",
            };
          } catch (error) {
            console.error(
              `[Controller] Error getting location for employee ${employee.id}:`,
              error
            );
            return null;
          }
        })
      );

      const validLocations = employeeLocations.filter((loc) => loc !== null);
      console.log(
        `[Controller] Returning ${validLocations.length} employee locations from database fallback`
      );

      res.json(validLocations);
    } catch (error) {
      console.error("Error getting active employee locations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get active employee locations",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get employee location history for group admin
   */
  async getEmployeeLocationHistory(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      const { employee_id, date } = req.query;

      if (!employee_id) {
        return res.status(400).json({
          success: false,
          message: "Employee ID is required",
        });
      }

      // Get the admin's company ID
      const adminResult = await pool.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [adminId]
      );

      const companyId = adminResult.rows[0].company_id;

      // Check if the employee belongs to the admin's company
      const employeeResult = await pool.query(
        `SELECT id FROM users WHERE id = $1 AND company_id = $2`,
        [employee_id, companyId]
      );

      if (employeeResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Employee not found or not part of your company",
        });
      }

      // Get location history for the employee
      let query;
      let params;

      if (date) {
        // Get locations for a specific date
        query = `
          SELECT 
            id,
            latitude,
            longitude,
            accuracy,
            battery_level as "batteryLevel",
            is_moving as "isMoving",
            geofence_status as "geofenceStatus",
            timestamp
          FROM employee_locations
          WHERE user_id = $1
          AND DATE(timestamp) = $2
          ORDER BY timestamp`;
        params = [employee_id, date];
      } else {
        // Get most recent locations within the last 24 hours
        query = `
          SELECT 
            id,
            latitude,
            longitude,
            accuracy,
            battery_level as "batteryLevel",
            is_moving as "isMoving",
            geofence_status as "geofenceStatus",
            timestamp
          FROM employee_locations
          WHERE user_id = $1
          AND timestamp > NOW() - INTERVAL '24 hours'
          ORDER BY timestamp`;
        params = [employee_id];
      }

      const result = await pool.query(query, params);

      // Get shift information for the same period
      let shiftQuery;
      let shiftParams;

      if (date) {
        shiftQuery = `
          SELECT 
            id,
            start_time as "startTime",
            end_time as "endTime",
            total_distance_km as "distance",
            travel_time_minutes as "duration"
          FROM employee_shifts
          WHERE user_id = $1
          AND DATE(start_time) = $2
          ORDER BY start_time`;
        shiftParams = [employee_id, date];
      } else {
        shiftQuery = `
          SELECT 
            id,
            start_time as "startTime",
            end_time as "endTime",
            total_distance_km as "distance",
            travel_time_minutes as "duration"
          FROM employee_shifts
          WHERE user_id = $1
          AND start_time > NOW() - INTERVAL '24 hours'
          ORDER BY start_time`;
        shiftParams = [employee_id];
      }

      const shiftResult = await pool.query(shiftQuery, shiftParams);

      res.status(200).json({
        success: true,
        locations: result.rows,
        shifts: shiftResult.rows,
      });
    } catch (error) {
      console.error("Error getting employee location history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get employee location history",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get analytics for an employee or all employees
   */
  async getAnalytics(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { employee_id, start_date, end_date } = req.query;

      const startDate = start_date
        ? new Date(start_date as string)
        : new Date();
      startDate.setDate(startDate.getDate() - 30); // Default to last 30 days

      const endDate = end_date ? new Date(end_date as string) : new Date();

      // Different queries for admin vs. employee
      if (req.user?.role === "GroupAdmin" && employee_id) {
        // Admin viewing a specific employee
        const result = await pool.query(
          `SELECT 
             date,
             total_distance_km as "totalDistance",
             total_travel_time_minutes as "totalTravelTime",
             outdoor_time_minutes as "outdoorTime",
             indoor_time_minutes as "indoorTime"
           FROM tracking_analytics
           WHERE user_id = $1
           AND date BETWEEN $2 AND $3
           ORDER BY date`,
          [
            employee_id,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
          ]
        );

        res.status(200).json({
          success: true,
          analytics: result.rows,
        });
      } else if (req.user?.role === "GroupAdmin") {
        // Admin viewing all employees
        const result = await pool.query(
          `SELECT 
             a.date,
             u.id as "userId",
             u.name as "userName",
             a.total_distance_km as "totalDistance",
             a.total_travel_time_minutes as "totalTravelTime"
           FROM tracking_analytics a
           JOIN users u ON a.user_id = u.id
           WHERE u.company_id = (SELECT company_id FROM users WHERE id = $1)
           AND a.date BETWEEN $2 AND $3
           ORDER BY a.date, u.name`,
          [
            userId || 0,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
          ]
        );

        res.status(200).json({
          success: true,
          analytics: result.rows,
        });
      } else {
        // Employee viewing their own analytics
        const result = await pool.query(
          `SELECT 
             date,
             total_distance_km as "totalDistance",
             total_travel_time_minutes as "totalTravelTime",
             outdoor_time_minutes as "outdoorTime",
             indoor_time_minutes as "indoorTime"
           FROM tracking_analytics
           WHERE user_id = $1
           AND date BETWEEN $2 AND $3
           ORDER BY date`,
          [
            userId || 0,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
          ]
        );

        res.status(200).json({
          success: true,
          analytics: result.rows,
        });
      }
    } catch (error) {
      console.error("Error getting analytics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get analytics",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export default new LocationTrackingController();
