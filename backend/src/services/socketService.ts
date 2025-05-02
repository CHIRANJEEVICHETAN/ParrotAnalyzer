import { Server } from 'socket.io';
import { createAdapter } from "@socket.io/postgres-adapter";
import { pool } from '../config/database';
import { Location } from "../types/liveTracking";
import { verifySocketToken } from "../utils/auth";
import { LocationValidationService } from "./LocationValidationService";
import { TrackingAnalyticsService } from "./TrackingAnalyticsService";
import { RetryService } from "./RetryService";
import { KalmanFilterService } from "./KalmanFilterService";
import { GeofenceHysteresisService } from "./GeofenceHysteresisService";
import { BatteryOptimizationService } from "./BatteryOptimizationService";
import { GroupAdminTrackingService } from "./GroupAdminTrackingService";
import { GeofenceManagementService } from "./GeofenceManagementService";
import { ShiftTrackingService } from "./ShiftTrackingService";
import { ErrorLoggingService } from "./ErrorLoggingService";
import { RedisManager } from "./RedisManager";

// Define our extended LocationUpdate interface
interface LocationUpdate extends Location {
  batteryLevel?: number;
  isMoving?: boolean;
  trackingStatus?: string;
  is_tracking_active?: boolean;
  isBackground?: boolean;
  userId: number; // Required field, not optional
}

class LocationSocketService {
  private io: Server;
  private redis: RedisManager;
  private locationValidator: LocationValidationService;
  private analyticsService: TrackingAnalyticsService;
  private retryService: RetryService;
  private geofenceHysteresis: GeofenceHysteresisService;
  private batteryOptimization: BatteryOptimizationService;
  private userFilters: Map<number, KalmanFilterService>;
  private groupAdminTracking: GroupAdminTrackingService;
  private geofenceService: GeofenceManagementService;
  private shiftService: ShiftTrackingService;
  private errorLogger: ErrorLoggingService;
  private kalmanFilters: Map<string, any>;

  constructor(httpServer: any) {
    // Initialize services
    this.redis = new RedisManager(
      process.env.REDIS_URL || "redis://localhost:6379"
    );

    // Set up a Redis health check and status monitor
    this.setupRedisMonitoring();

    this.errorLogger = new ErrorLoggingService();
    this.kalmanFilters = new Map();

    // Initialize Socket.IO with PostgreSQL adapter
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      adapter: createAdapter(pool),
    });

    this.locationValidator = new LocationValidationService();
    this.analyticsService = new TrackingAnalyticsService();
    this.retryService = new RetryService();
    this.geofenceHysteresis = new GeofenceHysteresisService();
    this.batteryOptimization = new BatteryOptimizationService();
    this.userFilters = new Map();
    this.groupAdminTracking = new GroupAdminTrackingService();
    this.geofenceService = new GeofenceManagementService();
    this.shiftService = new ShiftTrackingService();

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startRetryProcessor();
  }

  private setupRedisMonitoring(): void {
    // Handle Redis connection events
    this.redis.on("connect", () => {
      console.log("Redis connected successfully");
    });

    this.redis.on("error", (error) => {
      console.error("Redis error:", error);
    });

    this.redis.on("close", () => {
      console.log("Redis connection closed");
    });

    this.redis.on("reconnecting", (delay) => {
      console.log(`Redis reconnecting in ${delay}ms`);
    });

    this.redis.on("fallback", () => {
      console.warn("Redis in fallback mode, using local cache");
    });

    // Start periodic Redis health check
    setInterval(() => {
      if (!this.redis.isRedisConnected()) {
        console.log("Redis not connected, attempting to reconnect...");
        this.redis.forceReconnect();
      }
    }, 60000); // Check every minute
  }

  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error("Authentication token required");
        }

        const user = await verifySocketToken(token);
        socket.data.user = user;
        next();
      } catch (error: any) {
        await this.errorLogger.logError(error, "SocketAuth", undefined, {
          token: socket.handshake.auth.token,
        });
        next(new Error("Authentication failed"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id} - User: ${socket.data.user?.id} - Role: ${socket.data.user?.role}`);

      // Join appropriate rooms based on user role
      this.handleRoomJoining(socket);

      // Initialize Kalman filter for user
      this.userFilters.set(socket.data.user.id, new KalmanFilterService());

      // Handle location updates
      socket.on("location:update", async (data: any) => {
        try {
          // Add more detailed logging
          console.log(`Received location update from user ${socket.data.user?.id}`, {
            coords: data.latitude && data.longitude 
              ? `${data.latitude.toFixed(6)},${data.longitude.toFixed(6)}`
              : 'Invalid coordinates',
            timestamp: new Date().toISOString(),
            eventName: "location:update"
          });

          // Ensure data has the userId
          const locationUpdate: LocationUpdate = {
            ...data,
            userId: socket.data.user.id,
          };
          await this.handleLocationUpdate(socket, locationUpdate);
        } catch (error: any) {
          await this.errorLogger.logError(
            error,
            "LocationUpdate",
            socket.data.user.id,
            { locationData: data }
          );
          socket.emit("location:error", {
            message: error.message || "Failed to update location",
          });

          if (this.errorLogger.isRecoverableError(error)) {
            await this.retryService.queueForRetry(
              socket.data.user.id,
              data,
              error
            );
          }
        }
      });

      // Add a backup event name to handle any client misconfiguration
      socket.on("employee:location_update", async (data: any) => {
        try {
          console.log(`Received location update via alternate event from user ${socket.data.user?.id}`, {
            timestamp: new Date().toISOString(),
            eventName: "employee:location_update"
          });

          // Forward to standard handler
          const locationUpdate: LocationUpdate = {
            ...data,
            userId: socket.data.user.id,
          };
          await this.handleLocationUpdate(socket, locationUpdate);
        } catch (error: any) {
          await this.errorLogger.logError(
            error,
            "AlternateLocationUpdate",
            socket.data.user.id,
            { locationData: data }
          );
        }
      });

      // Handle group admin subscription to employee updates
      socket.on(
        "admin:subscribe_employees",
        async (data: { employeeIds: number[] }) => {
          try {
            if (
              socket.data.user.role !== "GroupAdmin" &&
              socket.data.user.role !== "Admin"
            ) {
              throw new Error(
                "Unauthorized: Only Group Admins can subscribe to employee updates"
              );
            }

            console.log(
              `Admin ${socket.data.user.id} subscribing to employees:`,
              data.employeeIds
            );

            // Validate that these employees belong to this admin
            const validEmployees =
              await this.groupAdminTracking.validateEmployeesForAdmin(
                socket.data.user.id,
                data.employeeIds
              );

            if (validEmployees.length === 0) {
              socket.emit("admin:subscription_error", {
                message: "No valid employees to subscribe to",
              });
              return;
            }

            // Subscribe to the employee updates
            await this.groupAdminTracking.subscribeToEmployeeUpdates(
              socket,
              validEmployees
            );

            socket.emit("admin:subscription_success", {
              employeeIds: validEmployees,
              message: `Subscribed to ${validEmployees.length} employee updates`,
            });
          } catch (error: any) {
            console.error("Error subscribing to employee updates:", error);
            await this.errorLogger.logError(
              error,
              "AdminSubscription",
              socket.data.user.id,
              { employeeIds: data.employeeIds }
            );
            socket.emit("admin:subscription_error", {
              message:
                error.message || "Failed to subscribe to employee updates",
            });
          }
        }
      );

      // Handle group admin unsubscription from employee updates
      socket.on(
        "admin:unsubscribe_employees",
        async (data: { employeeIds: number[] }) => {
          try {
            if (
              socket.data.user.role !== "GroupAdmin" &&
              socket.data.user.role !== "Admin"
            ) {
              throw new Error(
                "Unauthorized: Only Group Admins can unsubscribe from employee updates"
              );
            }

            console.log(
              `Admin ${socket.data.user.id} unsubscribing from employees:`,
              data.employeeIds
            );

            // Unsubscribe from the employee updates
            await this.groupAdminTracking.unsubscribeFromEmployeeUpdates(
              socket,
              data.employeeIds
            );

            socket.emit("admin:unsubscription_success", {
              message: `Unsubscribed from ${data.employeeIds.length} employee updates`,
            });
          } catch (error: any) {
            console.error("Error unsubscribing from employee updates:", error);
            await this.errorLogger.logError(
              error,
              "AdminUnsubscription",
              socket.data.user.id,
              { employeeIds: data.employeeIds }
            );
            socket.emit("admin:unsubscription_error", {
              message:
                error.message || "Failed to unsubscribe from employee updates",
            });
          }
        }
      );

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.data.user.id}`);
        this.handleDisconnection(socket);
      });

      // Handle failed updates retrieval
      socket.on("location:get_failed", async () => {
        try {
          const failedUpdates = await this.retryService.getFailedUpdates(
            socket.data.user.id
          );
          socket.emit("location:failed_updates", failedUpdates);
        } catch (error) {
          console.error("Error retrieving failed updates:", error);
          socket.emit("location:error", {
            message: "Failed to retrieve failed updates",
          });
        }
      });

      // Handle update interval requests
      socket.on(
        "location:get_interval",
        async (data: { batteryLevel: number; isCharging: boolean }) => {
          try {
            const lastLocation = await this.getLastLocation(
              socket.data.user.id
            );
            const interval =
              await this.batteryOptimization.getOptimalUpdateInterval(
                socket.data.user.id,
                data.batteryLevel,
                data.isCharging,
                lastLocation?.speed || 0,
                lastLocation?.isInGeofence || false
              );
            socket.emit("location:update_interval", { interval });
          } catch (error) {
            console.error("Error calculating update interval:", error);
            socket.emit("location:error", {
              message: "Failed to calculate update interval",
            });
          }
        }
      );
    });
  }

  private async handleLocationUpdate(
    socket: any,
    data: LocationUpdate
  ): Promise<void> {
    try {
      // Log background updates more verbosely
      if (data.isBackground) {
        console.log(
          `Received background location update via socket from user ${
            data.userId || socket.user?.id
          }`,
          {
            latitude: data.latitude,
            longitude: data.longitude,
            isBackground: true,
            timestamp: data.timestamp,
          }
        );
      }

      // Get user ID either from the data or from the socket
      const userId = data.userId || socket.user?.id;

      if (!userId) {
        console.error("No user ID provided in location update");
        socket.emit("error", {
          message: "No user ID provided in location update",
          code: "MISSING_USER_ID",
        });
        return;
      }

      // Apply Kalman filter to smooth location data
      let filteredLocation = data;

      try {
        // Get or create filter for this user
        let filter = this.userFilters.get(userId);
        if (!filter) {
          filter = new KalmanFilterService();
          this.userFilters.set(userId, filter);
        }

        // Only apply filter if not a background update (potentially outdated data)
        if (!data.isBackground) {
          // Use the update method from KalmanFilterService
          const smoothedCoords = filter.update({
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy || 10,
          });

          filteredLocation = {
            ...data,
            latitude: smoothedCoords.latitude,
            longitude: smoothedCoords.longitude,
          };
        }
      } catch (filterError) {
        console.error("Error applying Kalman filter:", filterError);
        // Use original location data if filtering fails
        filteredLocation = data;
      }

      // We don't need to track and report the battery level
      const cleanedLocation = {
        ...filteredLocation,
        batteryLevel: data.batteryLevel,
        timestamp: new Date().toISOString(),
        isBackground: !!data.isBackground,
      };

      // Pass the location to the processor which will handle the database update
      await this.processLocationUpdate(userId, cleanedLocation);

      // Check geofence transitions
      const geofenceResult = await this.checkGeofence(userId, cleanedLocation);

      // Broadcast to group admin or management
      await this.broadcastLocationUpdate(socket, cleanedLocation);

      // Update analytics
      try {
        // Use the correct signature for updateAnalytics
        await this.analyticsService.updateAnalytics(
          cleanedLocation,
          Number(userId)
        );
      } catch (analyticsError) {
        console.error("Error updating analytics:", analyticsError);
        // Don't fail the whole update if analytics fails
      }

      // Update last location cache
      await this.updateLastLocation(userId, {
        ...cleanedLocation,
        isInGeofence: geofenceResult?.isInside || false,
      });

      // Send acknowledgement to client that helps with battery optimization
      socket.emit("location:ack", {
        received: true,
        timestamp: new Date().toISOString(),
        // Only send battery optimization tips if not in background mode
        batteryOptimizations: !data.isBackground,
      });
    } catch (error) {
      console.error("Error handling location update:", error);

      // Use the correct method from ErrorLoggingService
      this.errorLogger.logError(
        error instanceof Error ? error : new Error(String(error)),
        "LocationUpdate",
        Number(socket.data?.user?.id || 0),
        { location: data && typeof data === "object" ? data : {} }
      );

      // Send error notification to client
      socket.emit("error", {
        message: "Failed to process location update",
        code: "LOCATION_UPDATE_ERROR",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async checkGeofence(
    userId: number,
    location: Location
  ): Promise<any> {
    const result = await pool.query(
      `SELECT cg.id as geofence_id, 
                ST_DWithin(
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                    cg.coordinates::geography,
                    cg.radius
                ) as is_inside
             FROM company_geofences cg
             JOIN users u ON u.company_id = cg.company_id
             WHERE u.id = $3`,
      [location.longitude, location.latitude, userId]
    );

    if (!result.rows.length) {
      return { isInside: false, transitionOccurred: false };
    }

    const geofence = result.rows[0];
    const hysteresisResult =
      await this.geofenceHysteresis.validateGeofenceState(
        userId,
        geofence.geofence_id,
        geofence.is_inside
      );

    return {
      ...hysteresisResult,
      geofenceId: geofence.geofence_id,
    };
  }

  private async processLocationUpdate(
    userId: number,
    location: Location
  ): Promise<void> {
    try {
      console.log(`[Socket] Processing location update for user ${userId}`);

      // Store in database
      await pool.query(
        `INSERT INTO employee_locations (user_id, latitude, longitude, accuracy, timestamp, battery_level, is_moving, is_tracking_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          location.latitude,
          location.longitude,
          location.accuracy,
          location.timestamp,
          location.batteryLevel,
          location.isMoving || false,
          location.is_tracking_active || false,
        ]
      );

      // Update the last known location in Redis
      await this.updateLastLocation(userId, location);

      console.log(`[Socket] Location update processed for user ${userId}`);
    } catch (error) {
      console.error(
        `[Socket] Error processing location update for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  private async updateLastLocation(
    userId: number,
    location: any
  ): Promise<void> {
    try {
      // Add timestamp for when this was saved
      const locationData = {
        ...location,
        lastUpdated: new Date().toISOString(),
      };

      // Store with multiple key formats to ensure compatibility
      const keyFormats = [
        `last_location:${userId}`,
        `location:${userId}`,
        `employee:location:${userId}`,
        `user:${userId}:location`,
      ];

      // Store in Redis with all key formats
      for (const key of keyFormats) {
        // Just use the basic set method without expiry for now
        await this.redis.set(key, JSON.stringify(locationData));
      }

      console.log(
        `Location updated in Redis for user ${userId} with ${keyFormats.length} key formats`
      );

      // Publish an update event that the admin socket can listen for
      this.io.to(`admin:tracking`).emit("employee-location-update", {
        userId,
        location: locationData,
      });
      this.io.to(`group-admin:${userId}`).emit("employee-location-update", {
        userId,
        location: locationData,
      });
    } catch (error) {
      console.error(`Error updating Redis location for user ${userId}:`, error);
    }
  }

  private async broadcastLocationUpdate(
    socket: any,
    location: Location
  ): Promise<void> {
    try {
      const userId = socket.data.user.id;

      // Get comprehensive user details including group admin and company info
      const userResult = await pool.query(
        `SELECT 
               u.group_admin_id, 
               u.name, 
               u.employee_number, 
               u.department, 
               u.designation, 
               u.company_id,
               el.is_tracking_active
             FROM users u
             LEFT JOIN LATERAL (
               SELECT is_tracking_active
               FROM employee_locations
               WHERE user_id = u.id
               ORDER BY timestamp DESC
               LIMIT 1
             ) el ON true
             WHERE u.id = $1`,
        [userId]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const employeeDetails = {
          id: userId,
          name: user.name,
          employeeNumber: user.employee_number,
          department: user.department,
          designation: user.designation,
        };

        // Get device info
        const deviceResult = await pool.query(
          `SELECT device_type, device_name
               FROM device_tokens
               WHERE user_id = $1
               AND is_active = true
               ORDER BY last_used_at DESC
               LIMIT 1`,
          [userId]
        );

        const deviceInfo =
          deviceResult.rows.length > 0
            ? `${deviceResult.rows[0].device_name || ""} (${
                deviceResult.rows[0].device_type || "unknown"
              })`
            : "Unknown device";

        // Enhanced employee location data
        const employeeLocationData = {
          employeeId: userId,
          name: user.name,
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            timestamp: location.timestamp || new Date().toISOString(),
            batteryLevel: location.batteryLevel || 0,
            isMoving: location.isMoving || false,
          },
          lastUpdated: new Date().toISOString(),

          // Use real-time battery level from current location update
          batteryLevel: location.batteryLevel || 0,

          // Prioritize real-time tracking status
          isActive:
            location.is_tracking_active !== undefined
              ? location.is_tracking_active
              : user.is_tracking_active || false,

          // Include raw tracking status if available for debugging
          trackingStatus: location.trackingStatus,

          employee: {
            ...employeeDetails,
            deviceInfo,
          },
        };

        // Get list of subscribers for this employee
        const subscribers = await this.getEmployeeSubscribers(userId);
        
        // Log detailed information about the broadcast
        console.log(`Broadcasting location for employee ${userId} to:`, {
          adminCount: subscribers.length,
          roomCount: this.io.sockets.adapter.rooms.get(`employee:${userId}`)?.size || 0,
          batteryLevel: location.batteryLevel,
          isMoving: location.isMoving,
          trackingActive: location.is_tracking_active,
          timestamp: new Date().toISOString()
        });

        // Broadcast to all relevant rooms using SAME EVENT NAME to ensure consistency
        
        // 1. Broadcast to employee's own room for immediate UI updates
        this.io.to(`employee:${userId}`).emit("employee:location_update", employeeLocationData);

        // 2. Broadcast to group admin specific room for this employee
        // NOTE: This is the key event that needs to match the admin subscription
        this.io.to(`employee:${userId}`).emit("employee:location_update", employeeLocationData);

        // 3. Broadcast to group admin room if available
        if (user.group_admin_id) {
          this.io.to(`admin:${user.group_admin_id}`).emit("employee:location_update", employeeLocationData);
          this.io.to(`group-admin:${user.group_admin_id}`).emit("employee:location_update", employeeLocationData);
        }

        // 4. Broadcast to company room if available
        if (user.company_id) {
          this.io.to(`company:${user.company_id}`).emit("employee:location_update", employeeLocationData);
        }

        // Cache in Redis with TTL
        const locationData = {
          ...location,
          lastUpdated: new Date().toISOString(),
          employee: {
            ...employeeDetails,
            deviceInfo,
          },
        };

        // Store with multiple key formats and TTL
        const keyFormats = [
          `last_location:${userId}`,
          `location:${userId}`,
          `employee:location:${userId}`,
          `user:${userId}:location`,
        ];

        // Use RedisManager to handle TTL and storage
        for (const key of keyFormats) {
          await this.redis.set(
            key,
            JSON.stringify(locationData),
            300 // 5 minute TTL
          );
        }

        console.log(`Location broadcast and cached for user ${userId}`);
      }
    } catch (error) {
      console.error("Error broadcasting location update:", error);
      
      // Don't throw error to prevent breaking the app flow
      // Instead, log to error monitoring and continue
      this.errorLogger.logError(
        error instanceof Error ? error : new Error(String(error)), 
        "BroadcastLocation", 
        socket?.data?.user?.id
      );
    }
  }

  private handleRoomJoining(socket: any): void {
    const { company_id, group_admin_id, role } = socket.data.user;

    // Join company room
    if (company_id) {
      socket.join(`company:${company_id}`);
    }

    // Join group room if user is an employee or group admin
    if (group_admin_id) {
      socket.join(`group:${group_admin_id}`);
    }

    // Join admin room if user is an admin
    if (role === "admin") {
      socket.join("admin");
    }
  }

  private async handleDisconnection(socket: any): Promise<void> {
    try {
      const { company_id, group_admin_id, role } = socket.data.user;

      // Clean up Kalman filter
      this.userFilters.delete(socket.data.user.id);

      // Handle group admin unsubscriptions
      if (role === "group_admin") {
        const employees = await pool.query(
          "SELECT id FROM users WHERE group_admin_id = $1",
          [socket.data.user.id]
        );
        const employeeIds = employees.rows.map((emp) => emp.id);
        await this.groupAdminTracking.unsubscribeFromEmployeeUpdates(
          socket,
          employeeIds
        );
      }

      // Leave all rooms
      if (company_id) socket.leave(`company:${company_id}`);
      if (group_admin_id) socket.leave(`group:${group_admin_id}`);
      if (role === "admin") socket.leave("admin");
      socket.leave(`user:${socket.data.user.id}`);
    } catch (error: any) {
      await this.errorLogger.logError(
        error,
        "SocketDisconnect",
        socket.data.user.id,
        { role: socket.data.user.role }
      );
      console.error("Error handling socket disconnection:", error);
    }
  }

  private startRetryProcessor(): void {
    // Process retry queue every minute
    setInterval(() => {
      this.retryService.processRetryQueue().catch((error) => {
        console.error("Error processing retry queue:", error);
      });
    }, 60000); // 1 minute
  }

  private async getLastLocation(userId: number): Promise<any> {
    const key = `last_location:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async handleConnection(socket: any): Promise<void> {
    try {
      // Authenticate user
      const userId = socket.user.id;
      const userRole = socket.user.role;

      if (userRole === "group_admin") {
        // Get employees under this admin
        const employees = await pool.query(
          "SELECT id FROM users WHERE group_admin_id = $1",
          [userId]
        );
        const employeeIds = employees.rows.map((emp) => emp.id);
        await this.groupAdminTracking.subscribeToEmployeeUpdates(
          socket,
          employeeIds
        );
      }

      socket.join(`user:${userId}`);
    } catch (error) {
      console.error("Error handling socket connection:", error);
      socket.disconnect(true);
    }
  }

  async handleShiftStart(
    socket: any,
    data: { latitude: number; longitude: number }
  ): Promise<void> {
    try {
      const userId = socket.user.id;
      await this.shiftService.startShift(userId, data.latitude, data.longitude);
      socket.emit("shiftStarted", { success: true });
    } catch (error: any) {
      await this.errorLogger.logError(error, "ShiftStart", socket.user.id, {
        locationData: data,
      });
      socket.emit("error", {
        message: error.message || "Failed to start shift",
      });
    }
  }

  async handleShiftEnd(
    socket: any,
    data: { latitude: number; longitude: number }
  ): Promise<void> {
    try {
      const userId = socket.user.id;
      const shiftData = await this.shiftService.endShift(
        userId,
        data.latitude,
        data.longitude
      );
      socket.emit("shiftEnded", { success: true, data: shiftData });
    } catch (error: any) {
      await this.errorLogger.logError(error, "ShiftEnd", socket.user.id, {
        locationData: data,
      });
      socket.emit("error", { message: error.message || "Failed to end shift" });
    }
  }

  // Add this helper method to better track subscribers
  private async getEmployeeSubscribers(employeeId: number): Promise<number[]> {
    try {
      // Get group admin and management for this employee
      const userResult = await pool.query(
        `SELECT 
          u.group_admin_id, 
          u.management_id,
          u.company_id
        FROM users u
        WHERE u.id = $1`,
        [employeeId]
      );

      if (userResult.rows.length === 0) {
        return [];
      }

      const { group_admin_id, management_id, company_id } = userResult.rows[0];
      const subscribers: number[] = [];

      // Add group admin if exists
      if (group_admin_id) {
        subscribers.push(group_admin_id);
      }

      // Add management if exists
      if (management_id) {
        subscribers.push(management_id);
      }

      // Get super admins and company admins
      const adminResult = await pool.query(
        `SELECT id FROM users 
         WHERE (role = 'Admin' OR role = 'SuperAdmin')
         AND (company_id = $1 OR role = 'SuperAdmin')`,
        [company_id]
      );

      // Add admin IDs
      for (const row of adminResult.rows) {
        subscribers.push(row.id);
      }

      console.log(`Found ${subscribers.length} subscribers for employee ${employeeId}`);
      return subscribers;
    } catch (error) {
      console.error(`Error getting employee subscribers:`, error);
      return [];
    }
  }
}

export default LocationSocketService; 