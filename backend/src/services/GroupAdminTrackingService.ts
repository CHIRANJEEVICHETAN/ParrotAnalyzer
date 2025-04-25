import { Redis } from 'ioredis';
import { pool } from '../config/database';
import { Location } from '../types/liveTracking';

export class GroupAdminTrackingService {
  private redis: Redis;
  private readonly LOCATION_TTL = 300; // 5 minutes
  private readonly BATCH_SIZE = 50;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  }

  async getActiveEmployeeLocations(groupAdminId: number): Promise<any[]> {
    try {
      console.log(
        `[GroupAdminTracking] Fetching employees for group admin ${groupAdminId}`
      );

      // Get all employees under this group admin with comprehensive details
      const employees = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.employee_number, u.designation, u.department 
         FROM users u
         WHERE (u.group_admin_id = $1 OR u.management_id = $1)
           AND u.status = 'active'
           AND u.role = 'employee'`,
        [groupAdminId]
      );

      console.log(
        `Found ${employees.rows.length} employees for group admin ${groupAdminId}`
      );

      if (employees.rows.length === 0) {
        return [];
      }

      // Create a map of employee IDs for quick lookup and to create a composite
      // cache key for the whole group
      const employeeIds = employees.rows.map((emp) => emp.id);

      // Try to get the cached locations for all employees from a composite key first
      const groupCacheKey = `admin:${groupAdminId}:employee_locations`;
      const cachedGroupLocations = await this.redis.get(groupCacheKey);

      if (cachedGroupLocations) {
        console.log(`Retrieved cached locations for admin ${groupAdminId}`);
        return JSON.parse(cachedGroupLocations);
      }

      // Get device info for all employees in a single query (more efficient)
      const deviceInfoResults = await pool.query(
        `SELECT dt.user_id, dt.device_type, dt.device_name, dt.app_version 
         FROM device_tokens dt
         WHERE dt.user_id = ANY($1::int[])
         AND dt.is_active = true
         ORDER BY dt.user_id, dt.last_used_at DESC`,
        [employeeIds]
      );

      // Create a map of user_id to device info
      const deviceInfoMap: Record<
        number,
        {
          deviceModel: string;
          deviceType: string;
          appVersion: string;
        }
      > = {};
      let lastUserId: number | null = null;

      deviceInfoResults.rows.forEach((device) => {
        // Only store the first (most recently used) device for each user
        if (lastUserId !== device.user_id) {
          deviceInfoMap[device.user_id] = {
            deviceModel: device.device_name || "Unknown device",
            deviceType: device.device_type || "unknown",
            appVersion: device.app_version || "",
          };
          lastUserId = device.user_id;
        }
      });

      // Batch process employee locations with improved structure
      const locations = await Promise.all(
        employees.rows.map(async (emp) => {
          // Try to get location from Redis
          const locationKey = `location:${emp.id}`;
          const locationData = await this.redis.get(locationKey);

          // Employee base details
          const employeeDetails = {
            id: emp.id,
            name: emp.name,
            email: emp.email,
            employeeNumber: emp.employee_number,
            designation: emp.designation,
            department: emp.department,
            deviceInfo: deviceInfoMap[emp.id]
              ? `${deviceInfoMap[emp.id].deviceModel} (${
                  deviceInfoMap[emp.id].deviceType
                })`
              : "Unknown device",
          };

          if (locationData) {
            // Parse the location data and ensure it has the employee property
            const parsedLocation = JSON.parse(locationData);

            // If the location data already has employee details, use those
            // otherwise, add the details we just fetched
            if (!parsedLocation.employee) {
              parsedLocation.employee = employeeDetails;
            }

            return parsedLocation;
          }

          // If Redis doesn't have the location, check the database
          const recentLocation = await pool.query(
            `SELECT latitude, longitude, accuracy, timestamp, battery_level, is_moving
             FROM employee_locations 
             WHERE user_id = $1 
             ORDER BY timestamp DESC 
             LIMIT 1`,
            [emp.id]
          );

          if (recentLocation.rows.length > 0) {
            const dbLocation = recentLocation.rows[0];

            // Create a complete location object
            const locationData = {
              latitude: dbLocation.latitude,
              longitude: dbLocation.longitude,
              accuracy: dbLocation.accuracy,
              timestamp: dbLocation.timestamp,
              batteryLevel: dbLocation.battery_level,
              isMoving: dbLocation.is_moving,
              lastUpdated: new Date().toISOString(),
              employee: employeeDetails,
              source: "database",
            };

            // Store in Redis for future use
            await this.redis.set(
              locationKey,
              JSON.stringify(locationData),
              "EX",
              this.LOCATION_TTL
            );

            return locationData;
          }

          // If no location data is found, return null
          return null;
        })
      );

      // Filter out null values
      const validLocations = locations.filter((loc) => loc !== null);

      // Cache the entire result for the admin to improve performance on future requests
      if (validLocations.length > 0) {
        await this.redis.set(
          groupCacheKey,
          JSON.stringify(validLocations),
          "EX",
          60 // Cache for 1 minute to ensure fresh data but reduce DB load
        );
      }

      return validLocations;
    } catch (error) {
      console.error("Error fetching active employee locations:", error);
      throw error;
    }
  }

  async getSingleEmployeeLocation(
    employeeId: number,
    groupAdminId: number
  ): Promise<any> {
    try {
      // Verify employee belongs to group admin
      const employee = await pool.query(
        `SELECT id, name, email 
                FROM users 
                WHERE id = $1 
                AND group_admin_id = $2`,
        [employeeId, groupAdminId]
      );

      if (!employee.rows.length) {
        throw new Error("Employee not found or unauthorized");
      }

      const location = await this.redis.get(`location:${employeeId}`);
      if (!location) {
        return null;
      }

      return {
        employee: employee.rows[0],
        ...JSON.parse(location),
      };
    } catch (error) {
      console.error("Error fetching single employee location:", error);
      throw error;
    }
  }

  async getEmployeeLocationHistory(
    employeeId: number,
    groupAdminId: number,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      // Verify employee belongs to group admin
      const employee = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND group_admin_id = $2",
        [employeeId, groupAdminId]
      );

      if (!employee.rows.length) {
        throw new Error("Employee not found or unauthorized");
      }

      // Get location history excluding geofence areas
      const history = await pool.query(
        `SELECT el.*, 
                    NOT EXISTS (
                        SELECT 1 
                        FROM company_geofences cg 
                        WHERE ST_DWithin(
                            ST_SetSRID(ST_MakePoint(el.longitude, el.latitude), 4326)::geography,
                            cg.coordinates::geography,
                            cg.radius
                        )
                    ) as is_travel_point
                FROM employee_locations el
                WHERE el.user_id = $1 
                AND el.timestamp BETWEEN $2 AND $3
                ORDER BY el.timestamp DESC`,
        [employeeId, startDate, endDate]
      );

      return history.rows;
    } catch (error) {
      console.error("Error fetching employee location history:", error);
      throw error;
    }
  }

  async subscribeToEmployeeUpdates(
    socket: any,
    employeeIds: number[]
  ): Promise<void> {
    try {
      // Join rooms for each employee
      for (const empId of employeeIds) {
        socket.join(`employee:${empId}`);
      }
    } catch (error) {
      console.error("Error subscribing to employee updates:", error);
      throw error;
    }
  }

  async unsubscribeFromEmployeeUpdates(
    socket: any,
    employeeIds: number[]
  ): Promise<void> {
    try {
      // Leave rooms for each employee
      for (const empId of employeeIds) {
        socket.leave(`employee:${empId}`);
      }
    } catch (error) {
      console.error("Error unsubscribing from employee updates:", error);
      throw error;
    }
  }

  async validateEmployeesForAdmin(
    adminId: number,
    employeeIds: number[]
  ): Promise<number[]> {
    try {
      // Return empty array if no IDs provided
      if (!employeeIds || employeeIds.length === 0) {
        return [];
      }

      // Get all valid employees that belong to this admin
      const result = await pool.query(
        `SELECT id 
                 FROM users 
                 WHERE id = ANY($1) 
                 AND (
                     group_admin_id = $2
                     OR (
                         SELECT company_id FROM users WHERE id = $2
                     ) = company_id
                 )`,
        [employeeIds, adminId]
      );

      // Extract just the IDs into an array
      return result.rows.map((emp) => emp.id);
    } catch (error) {
      console.error("Error validating employees for admin:", error);
      throw error;
    }
  }
} 