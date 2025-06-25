import { pool } from '../config/database';
import { GeofenceManagementService } from './GeofenceManagementService';
import notificationService from './notificationService';
import { format, differenceInSeconds } from 'date-fns';
import { sendAttendanceToSparrow, getEmployeeCode } from './sparrowAttendanceService';
import { ErrorLoggingService } from './ErrorLoggingService';

export class ShiftTrackingService {
    private geofenceService: GeofenceManagementService;
    private errorLogger: ErrorLoggingService;

    constructor() {
        this.geofenceService = new GeofenceManagementService();
        this.errorLogger = new ErrorLoggingService();
    }

    // Helper function to check if Sparrow API should be called
    private async shouldUseSparrowAPI(userId: number): Promise<boolean> {
        // Check environment
        if (process.env.NODE_ENV === 'development') {
            console.log('Skipping Sparrow API in development environment');
            return false;
        }
        
        // Check if user belongs to Tecosoft (company ID = 1)
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT company_id FROM users WHERE id = $1',
                [userId]
            );
            
            if (!result.rows.length) return false;
            
            const companyId = result.rows[0].company_id;
            const isTecosoftUser = companyId === 1;
            
            if (!isTecosoftUser) {
                console.log(`User ${userId} belongs to company ${companyId}, not Tecosoft (ID: 1). Skipping Sparrow API.`);
            }
            
            return isTecosoftUser;
        } catch (error) {
            // Log company ID check error to database and console
            await this.errorLogger.logError(
                error instanceof Error ? error : new Error(`Company ID check failed: ${error}`),
                'ShiftTrackingService',
                userId,
                {
                    action: 'shouldUseSparrowAPI-company-check',
                    userId
                }
            );
            console.error('Error checking company ID:', error);
            return false;
        } finally {
            client.release();
        }
    }

    async startShift(userId: number, latitude: number, longitude: number): Promise<any> {
        try {
            // Validate location is within geofence
            const validation = await this.geofenceService.validateShiftLocation(
                userId,
                latitude,
                longitude
            );

            if (!validation.isValid) {
                throw new Error(validation.message || 'Invalid shift start location');
            }

            // Start new shift
            const result = await pool.query(
                `INSERT INTO employee_shifts 
                (user_id, start_time, start_location)
                VALUES ($1, NOW(), ST_SetSRID(ST_MakePoint($2, $3), 4326))
                RETURNING *`,
                [userId, longitude, latitude]
            );

            // Initialize tracking analytics
            await pool.query(
                `INSERT INTO tracking_analytics 
                (user_id, date, total_distance_km, total_travel_time_minutes)
                VALUES ($1, CURRENT_DATE, 0, 0)`,
                [userId]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error starting shift:', error);
            throw error;
        }
    }

    async endShift(userId: number, latitude: number, longitude: number): Promise<any> {
        try {
            // Validate location is within geofence
            const validation = await this.geofenceService.validateShiftLocation(
                userId,
                latitude,
                longitude
            );

            if (!validation.isValid) {
                throw new Error(validation.message || 'Invalid shift end location');
            }

            // Get current shift
            const currentShift = await pool.query(
                `SELECT id, start_time, location_history 
                FROM employee_shifts 
                WHERE user_id = $1 
                AND end_time IS NULL`,
                [userId]
            );

            if (!currentShift.rows.length) {
                throw new Error('No active shift found');
            }

            // Calculate final metrics excluding geofence areas
            const metrics = await this.calculateShiftMetrics(currentShift.rows[0].id);

            // End shift
            const result = await pool.query(
                `UPDATE employee_shifts 
                SET end_time = NOW(),
                    end_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
                    total_distance_km = $3,
                    travel_time_minutes = $4
                WHERE id = $5
                RETURNING *`,
                [longitude, latitude, metrics.distance, metrics.travelTime, currentShift.rows[0].id]
            );

            // Update analytics
            await pool.query(
                `UPDATE tracking_analytics 
                SET total_distance_km = total_distance_km + $1,
                    total_travel_time_minutes = total_travel_time_minutes + $2
                WHERE user_id = $3 
                AND date = CURRENT_DATE`,
                [metrics.distance, metrics.travelTime, userId]
            );

            // Mark any related timer as completed
            await pool.query(
                `UPDATE shift_timer_settings 
                SET completed = TRUE 
                WHERE shift_id = $1`,
                [currentShift.rows[0].id]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error ending shift:', error);
            throw error;
        }
    }

    private async calculateShiftMetrics(shiftId: number): Promise<{ distance: number; travelTime: number }> {
        try {
            // Get all locations for this shift excluding geofence areas
            const locations = await pool.query(
                `SELECT el.* 
                FROM employee_locations el
                WHERE el.shift_id = $1
                AND NOT EXISTS (
                    SELECT 1 
                    FROM company_geofences cg 
                    JOIN users u ON u.company_id = cg.company_id
                    WHERE u.id = el.user_id
                    AND ST_DWithin(
                        ST_SetSRID(ST_MakePoint(el.longitude, el.latitude), 4326)::geography,
                        cg.coordinates::geography,
                        cg.radius
                    )
                )
                ORDER BY el.timestamp`,
                [shiftId]
            );

            let totalDistance = 0;
            let travelTime = 0;
            let lastLocation = null;

            for (const location of locations.rows) {
                if (lastLocation) {
                    // Calculate distance using PostGIS
                    const distanceResult = await pool.query(
                        `SELECT ST_Distance(
                            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                            ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
                        ) as distance`,
                        [
                            lastLocation.longitude,
                            lastLocation.latitude,
                            location.longitude,
                            location.latitude
                        ]
                    );

                    totalDistance += distanceResult.rows[0].distance;

                    // Calculate time difference in minutes
                    const timeDiff = (new Date(location.timestamp).getTime() - 
                        new Date(lastLocation.timestamp).getTime()) / (1000 * 60);
                    travelTime += timeDiff;
                }
                lastLocation = location;
            }

            return {
                distance: totalDistance / 1000, // Convert to kilometers
                travelTime: Math.round(travelTime)
            };
        } catch (error) {
            console.error('Error calculating shift metrics:', error);
            throw error;
        }
    }

    async getCurrentShift(userId: number): Promise<any> {
        try {
            const result = await pool.query(
                `SELECT * FROM employee_shifts 
                WHERE user_id = $1 
                AND end_time IS NULL`,
                [userId]
            );

            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting current shift:', error);
            throw error;
        }
    }

    // Add a helper function to determine role-specific shift table and columns
    private async getRoleShiftTable(userRole: string): Promise<{
        table: string;
        idColumn: string;
        userColumn: string;
        startColumn: string;
        endColumn: string;
        statusColumn: string;
        durationColumn: string;
    }> {
        switch(userRole) {
            case 'employee':
                return {
                    table: 'employee_shifts',
                    idColumn: 'id',
                    userColumn: 'user_id',
                    startColumn: 'start_time',
                    endColumn: 'end_time',
                    statusColumn: 'status',
                    durationColumn: 'duration'
                };
            case 'group-admin':
                return {
                    table: 'group_admin_shifts',
                    idColumn: 'id',
                    userColumn: 'user_id',
                    startColumn: 'start_time',
                    endColumn: 'end_time',
                    statusColumn: 'status',
                    durationColumn: 'duration'
                };
            case 'management':
                return {
                    table: 'management_shifts',
                    idColumn: 'id',
                    userColumn: 'user_id',
                    startColumn: 'start_time',
                    endColumn: 'end_time',
                    statusColumn: 'status',
                    durationColumn: 'duration'
                };
            default:
                throw new Error('Invalid user role');
        }
    }

    // Update the setShiftTimer function to handle different role tables correctly
    async setShiftTimer(userId: number, durationHours: number): Promise<any> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // First, get the user's role
            const userResult = await client.query(
                'SELECT role FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const userRole = userResult.rows[0].role;
            const { table, idColumn, userColumn, startColumn, endColumn } = await this.getRoleShiftTable(userRole);

            // Get current active shift from the appropriate table
            const shiftResult = await client.query(
                `SELECT ${idColumn}, ${startColumn} FROM ${table} 
                WHERE ${userColumn} = $1 AND ${endColumn} IS NULL`,
                [userId]
            );

            if (shiftResult.rows.length === 0) {
                throw new Error('No active shift found');
            }

            const shiftId = shiftResult.rows[0][idColumn];
            const startTime = new Date(shiftResult.rows[0][startColumn]);
            
            // Check for existing timer and delete it
            await client.query(
                `DELETE FROM shift_timer_settings WHERE user_id = $1 AND completed = FALSE`,
                [userId]
            );

            // Set timezone to Asia/Kolkata (IST) for consistent handling
            await client.query("SET timezone = 'Asia/Kolkata'");

            // Insert timer with IST timezone - store as timestamptz to preserve timezone
            const timerResult = await client.query(
                `INSERT INTO shift_timer_settings 
                (shift_id, user_id, timer_duration_hours, end_time, role_type, shift_table_name) 
                VALUES (
                    $1, $2, $3, 
                    ($4::timestamp AT TIME ZONE 'Asia/Kolkata' + ($5 || ' hours')::interval)::timestamptz,
                    $6, $7
                ) 
                RETURNING *, end_time`,
                [shiftId, userId, durationHours, startTime, durationHours, userRole, table]
            );

            await client.query('COMMIT');
            
            // Return the timer with timezone info preserved
            return {
                ...timerResult.rows[0]
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error setting shift timer:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Update cancelShiftTimer - no change needed since it works by user_id
    // But we'll keep it for completeness
    async cancelShiftTimer(userId: number): Promise<boolean> {
        try {
            const result = await pool.query(
                `DELETE FROM shift_timer_settings 
                WHERE user_id = $1 AND completed = FALSE
                RETURNING id`,
                [userId]
            );
            
            return result.rows.length > 0;
        } catch (error) {
            console.error('Error canceling shift timer:', error);
            throw error;
        }
    }

    // Update getCurrentShiftTimer to handle IST timezone
    async getCurrentShiftTimer(userId: number): Promise<any> {
        const client = await pool.connect();
        try {
            // First, get the user's role
            const userResult = await client.query(
                'SELECT role FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const userRole = userResult.rows[0].role;
            const shiftTableName = await this.getShiftTableNameFromRole(userRole);
            
            // Set timezone to Asia/Kolkata (IST)
            await client.query("SET timezone = 'Asia/Kolkata'");

            // Query with IST timezone and proper formatting
            const result = await client.query(
                `SELECT 
                    sts.id, 
                    sts.shift_id, 
                    sts.user_id, 
                    sts.timer_duration_hours,
                    sts.end_time,
                    sts.role_type,
                    sts.shift_table_name,
                    sts.completed,
                    s.start_time AT TIME ZONE 'Asia/Kolkata' as start_time
                FROM shift_timer_settings sts
                JOIN ${shiftTableName} s ON sts.shift_id = s.id
                WHERE sts.user_id = $1 
                AND sts.completed = FALSE
                AND sts.role_type = $2
                AND s.end_time IS NULL`,
                [userId, userRole]
            );

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error getting shift timer:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Update processPendingTimers to handle all role types using shift_table_name
    async processPendingTimers(): Promise<number> {
        const client = await pool.connect();
        let endedShifts = 0;
        
        try {
            await client.query('BEGIN');
            
            // Set timezone to IST for this session
            await client.query("SET timezone = 'Asia/Kolkata'");
            
            // Get all pending timers regardless of role
            // Use IST timezone for comparisons
            const timerResult = await client.query(
                `SELECT sts.id, sts.shift_id, sts.user_id, 
                        sts.end_time, 
                        sts.timer_duration_hours, sts.role_type, sts.shift_table_name
                FROM shift_timer_settings sts
                WHERE sts.completed = FALSE
                AND sts.end_time <= NOW()`
            );

            console.log(`Found ${timerResult.rows.length} pending timers to process at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}`);

            // Process each shift that needs to end
            for (const timer of timerResult.rows) {
                try {
                  console.log(
                    `Processing timer for shift ${timer.shift_id}, user ${timer.user_id}, end time ${timer.end_time}`
                  );
                  const userRole = timer.role_type;
                  const shiftTable =
                    timer.shift_table_name ||
                    (await this.getShiftTableNameFromRole(userRole));
                  const {
                    idColumn,
                    userColumn,
                    startColumn,
                    endColumn,
                    statusColumn,
                    durationColumn,
                  } = await this.getRoleShiftTable(userRole);

                  // Check if the shift is still active
                  const shiftResult = await client.query(
                    `SELECT ${startColumn} FROM ${shiftTable} 
                        WHERE ${idColumn} = $1 AND ${endColumn} IS NULL`,
                    [timer.shift_id]
                  );

                  if (shiftResult.rows.length === 0) {
                    // Shift already ended, just mark the timer as completed
                    await client.query(
                      `UPDATE shift_timer_settings 
                            SET completed = TRUE 
                            WHERE id = $1`,
                      [timer.id]
                    );
                    continue;
                  }

                  const startTime = new Date(shiftResult.rows[0][startColumn]);

                  // Get user info for notifications
                  const userResult = await client.query(
                    `SELECT name, role FROM users WHERE id = $1`,
                    [timer.user_id]
                  );

                  if (userResult.rows.length === 0) {
                    console.error(`User not found for ID: ${timer.user_id}`);
                    continue;
                  }

                  const user = userResult.rows[0];

                  // Initialize variables for Sparrow response tracking
                  let hasSparrowWarning = false;
                  let sparrowErrorDetails: any = {};

                  // Calculate elapsed time in seconds for notification formatting only
                  const elapsedSeconds = Math.max(0, Math.floor(
                    (new Date(timer.end_time).getTime() - startTime.getTime()) / 1000
                  ));

                  if (userRole === "employee") {

                                         // Check if Sparrow API should be used for auto-end
                     const useSparrowAPI = await this.shouldUseSparrowAPI(timer.user_id);
                     
                     // Only call Sparrow API if conditions are met
                     if (useSparrowAPI) {
                       let employeeCode: string | null = null;
                       try {
                         // Get employee code and call Sparrow API
                         employeeCode = await getEmployeeCode(timer.user_id);
                         if (employeeCode) {
                           console.log(`[Auto-End] Calling Sparrow API for employee ${employeeCode} (User ID: ${timer.user_id})`);
                           
                           // Call Sparrow API before updating our database record
                           const sparrowResponse = await sendAttendanceToSparrow([employeeCode]);
                           
                           // For auto-end, we handle cooldown errors differently than manual end
                           // We log the error but don't prevent the auto-end from happening
                           if (!sparrowResponse.success) {
                             hasSparrowWarning = true;
                             sparrowErrorDetails = {
                               sparrowWarning: true,
                               sparrowMessage: sparrowResponse.message,
                               sparrowErrors: sparrowResponse.sparrowErrors,
                               sparrowErrorType: sparrowResponse.errorType
                             };
                             
                             // Log Sparrow error to database and console
                             await this.errorLogger.logError(
                               new Error(`Sparrow API error during auto-end: ${sparrowResponse.message}`),
                               'ShiftTrackingService',
                               timer.user_id,
                               {
                                 action: 'auto-end-sparrow-integration',
                                 employeeCode,
                                 sparrowErrorType: sparrowResponse.errorType,
                                 sparrowErrors: sparrowResponse.sparrowErrors,
                                 statusCode: sparrowResponse.statusCode,
                                 shiftId: timer.shift_id,
                                 timerDuration: timer.timer_duration_hours
                               }
                             );
                             
                             console.log(`[Auto-End] Sparrow API warning for user ${timer.user_id}:`, sparrowErrorDetails);
                           } else {
                             console.log(`[Auto-End] Sparrow API success for user ${timer.user_id}`);
                           }
                         }
                       } catch (sparrowError) {
                         // Log Sparrow exception to database and console
                         await this.errorLogger.logError(
                           sparrowError instanceof Error ? sparrowError : new Error(`Sparrow API exception during auto-end: ${sparrowError}`),
                           'ShiftTrackingService',
                           timer.user_id,
                           {
                             action: 'auto-end-sparrow-integration',
                             employeeCode: employeeCode || 'unknown',
                             shiftId: timer.shift_id,
                             timerDuration: timer.timer_duration_hours,
                             errorDetails: sparrowError
                           }
                         );
                         
                         console.error(`[Auto-End] Sparrow API error for user ${timer.user_id}:`, sparrowError);
                         // Continue with auto-end even if Sparrow fails
                         hasSparrowWarning = true;
                         sparrowErrorDetails = {
                           sparrowWarning: true,
                           sparrowMessage: "Failed to update attendance system",
                           sparrowErrorType: "SPARROW_UNKNOWN_ERROR"
                         };
                       }
                     }

                    // For employee shifts, calculate metrics
                    const metrics = await this.calculateShiftMetrics(
                      timer.shift_id
                    );

                    // End employee shift with metrics - let PostgreSQL calculate duration properly
                    await client.query(
                      `UPDATE ${shiftTable} 
                            SET ${endColumn} = ($1::timestamptz AT TIME ZONE 'Asia/Kolkata')::timestamp,
                                total_distance_km = $2,
                                travel_time_minutes = $3,
                                ended_automatically = TRUE,
                                updated_at = CURRENT_TIMESTAMP,
                                ${statusColumn} = 'completed',
                                ${durationColumn} = ($1::timestamptz AT TIME ZONE 'Asia/Kolkata')::timestamp - ${startColumn}
                            WHERE ${idColumn} = $4`,
                      [
                        timer.end_time,
                        metrics.distance,
                        metrics.travelTime,
                        timer.shift_id,
                      ]
                    );

                    // Update analytics for employee
                    await client.query(
                      `UPDATE tracking_analytics 
                            SET total_distance_km = total_distance_km + $1,
                                total_travel_time_minutes = total_travel_time_minutes + $2
                            WHERE user_id = $3 
                            AND date = CURRENT_DATE`,
                      [metrics.distance, metrics.travelTime, timer.user_id]
                    );
                  } else {
                    // For group-admin and management, just end the shift without metrics
                    // First add ended_automatically column if it doesn't exist
                    try {
                      if (
                        userRole === "group-admin" &&
                        shiftTable === "group_admin_shifts"
                      ) {
                        await client.query(
                          `ALTER TABLE group_admin_shifts 
                                    ADD COLUMN IF NOT EXISTS ended_automatically BOOLEAN DEFAULT FALSE`
                        );
                      } else if (
                        userRole === "management" &&
                        shiftTable === "management_shifts"
                      ) {
                        await client.query(
                          `ALTER TABLE management_shifts 
                                    ADD COLUMN IF NOT EXISTS ended_automatically BOOLEAN DEFAULT FALSE`
                        );
                      }
                    } catch (alterError: any) {
                      // Column might already exist, continue
                      console.log(
                        `Column check error (can be ignored): ${alterError.message}`
                      );
                    }

                    // End the shift - use AT TIME ZONE to ensure IST storage
                    await client.query(
                      `UPDATE ${shiftTable} 
                            SET ${endColumn} = ($1::timestamptz AT TIME ZONE 'Asia/Kolkata')::timestamp,
                                ended_automatically = TRUE,
                                updated_at = CURRENT_TIMESTAMP,
                                ${statusColumn} = 'completed',
                                ${durationColumn} = ($1::timestamptz AT TIME ZONE 'Asia/Kolkata')::timestamp - ${startColumn}
                            WHERE ${idColumn} = $2`,
                      [timer.end_time, timer.shift_id]
                    );
                  }

                  // Mark timer as completed
                  await client.query(
                    `UPDATE shift_timer_settings 
                        SET completed = TRUE 
                        WHERE id = $1`,
                    [timer.id]
                  );

                  // Commit the database changes before sending notifications
                  await client.query("COMMIT");
                  await client.query("BEGIN");

                  // Send notifications outside the transaction
                  try {
                    // Format duration as HH:MM:SS
                    const hours = Math.floor(elapsedSeconds / 3600);
                    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
                    const seconds = Math.floor(elapsedSeconds % 60);
                    const formattedDuration = `${hours
                      .toString()
                      .padStart(2, "0")}:${minutes
                      .toString()
                      .padStart(2, "0")}:${seconds
                      .toString()
                      .padStart(2, "0")}`;

                    // Prepare user notification message with Sparrow warning if applicable
                    let userMessage = `Your ${timer.timer_duration_hours}-hour shift has been automatically completed as scheduled.`;
                    
                    // Add Sparrow warning to user notification if there was an issue
                    if (userRole === "employee" && hasSparrowWarning && sparrowErrorDetails.sparrowMessage) {
                      userMessage += ` Note: ${sparrowErrorDetails.sparrowMessage}`;
                    }

                    // Send notification to user
                    await notificationService
                      .sendPushNotification({
                        id: 0,
                        user_id: timer.user_id.toString(),
                        title: "Shift Automatically Ended",
                        message: userMessage,
                        type: "shift-end-auto",
                        priority: "default",
                        data: {
                          shiftId: timer.shift_id,
                          startTime: startTime.toISOString(),
                          endTime: timer.end_time,
                          duration: timer.timer_duration_hours,
                          ...(userRole === "employee" && hasSparrowWarning && sparrowErrorDetails)
                        },
                      })
                      .catch((error) => {
                        console.error(
                          "Error sending user notification:",
                          error
                        );
                        // Don't throw, just log the error
                      });

                    // Send notification to appropriate admin/manager
                    const notificationEndpoint =
                      user.role === "employee"
                        ? "employee-notifications/notify-admin"
                        : user.role === "group-admin"
                        ? "group-admin-notifications/notify-admin"
                        : null;

                    if (notificationEndpoint) {
                      // Prepare notification message with Sparrow warning if applicable
                      let notificationMessage = `👤 ${
                        user.name
                      } has completed their scheduled ${
                        timer.timer_duration_hours
                      }-hour shift\n⏱️ Duration: ${formattedDuration}\n🕒 Start: ${format(
                        startTime,
                        "hh:mm a"
                      )}\n🕕 End: ${format(
                        new Date(timer.end_time),
                        "hh:mm a"
                      )}`;

                      // Add Sparrow warning to notification if there was an issue
                      if (userRole === "employee" && hasSparrowWarning && sparrowErrorDetails.sparrowMessage) {
                        notificationMessage += `\n\n⚠️ Attendance System Warning: ${sparrowErrorDetails.sparrowMessage}`;
                      }

                      await notificationService
                        .sendRoleNotification(
                          timer.user_id,
                          user.role === "employee"
                            ? "group-admin"
                            : "management",
                          {
                            title: `🔴 Shift Auto-Ended for ${user.name}`,
                            message: notificationMessage,
                            type: "shift-end-auto",
                            priority: "default",
                            data: {
                              shiftId: timer.shift_id,
                              userId: timer.user_id,
                              userName: user.name,
                              startTime: startTime.toISOString(),
                              endTime: timer.end_time,
                              duration: timer.timer_duration_hours,
                              ...(userRole === "employee" && hasSparrowWarning && sparrowErrorDetails)
                            },
                          }
                        )
                        .catch((error) => {
                          console.error(
                            "Error sending admin notification:",
                            error
                          );
                          // Don't throw, just log the error
                        });
                    }
                  } catch (notificationError) {
                    console.error(
                      "Error sending notifications:",
                      notificationError
                    );
                    // Don't throw the error, just log it
                  }

                  endedShifts++;
                } catch (shiftError) {
                    console.error(`Error processing shift for timer ID ${timer.id}:`, shiftError);
                    // Start a new transaction for the next shift
                    await client.query('ROLLBACK');
                    await client.query('BEGIN');
                }
            }

            // Final commit if there are any pending changes
            await client.query('COMMIT');
            return endedShifts;

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error processing timers:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Helper function to get table name from role if needed
    private async getShiftTableNameFromRole(role: string): Promise<string> {
        switch (role) {
            case 'employee':
                return 'employee_shifts';
            case 'group-admin':
                return 'group_admin_shifts';
            case 'management':
                return 'management_shifts';
            default:
                return 'employee_shifts';
        }
    }

    // Update sendTimerReminders to support all roles using shift_table_name
    async sendTimerReminders(reminderMinutes: number = 5): Promise<number> {
        try {
            // Set timezone to IST for this session
            await pool.query("SET timezone = 'Asia/Kolkata'");
            
            // Find timers that need reminders (end time approaching within the reminder window but notification not yet sent)
            const timerResult = await pool.query(
                `SELECT sts.id, sts.shift_id, sts.user_id, 
                        sts.end_time, 
                        sts.timer_duration_hours, sts.role_type, sts.shift_table_name, u.name 
                FROM shift_timer_settings sts
                JOIN users u ON sts.user_id = u.id
                WHERE sts.completed = FALSE 
                AND sts.notification_sent = FALSE
                AND sts.end_time <= (NOW() + interval '${reminderMinutes} minutes')
                AND sts.end_time > NOW()`
            );

            let sentCount = 0;

            for (const timer of timerResult.rows) {
                try {
                    const userRole = timer.role_type;
                    const shiftTable = timer.shift_table_name || await this.getShiftTableNameFromRole(userRole);
                    const { idColumn, startColumn } = await this.getRoleShiftTable(userRole);
                    
                    // Get shift start time
                    const shiftResult = await pool.query(
                        `SELECT ${startColumn} FROM ${shiftTable} WHERE ${idColumn} = $1`,
                        [timer.shift_id]
                    );
                    
                    if (shiftResult.rows.length === 0) {
                        continue; // Skip if shift not found
                    }
                    
                    // Send notification
                    await notificationService.sendPushNotification({
                        id: 0, // Will be set by the DB
                        user_id: timer.user_id.toString(),
                        title: "⏰ Shift Ending Soon",
                        message: `Your shift will automatically end in ${reminderMinutes} minutes.`,
                        type: "shift-ending-soon",
                        priority: "high",
                        data: {
                            shiftId: timer.shift_id,
                            endTime: timer.end_time,
                            minutesRemaining: reminderMinutes
                        }
                    });

                    // Mark notification as sent
                    await pool.query(
                        `UPDATE shift_timer_settings 
                        SET notification_sent = TRUE 
                        WHERE id = $1`,
                        [timer.id]
                    );

                    console.log(`[${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}] Sent reminder notification for timer ID ${timer.id}, user ${timer.user_id}, shift ${timer.shift_id}`);
                    sentCount++;
                } catch (error: any) {
                    console.error(`Error sending reminder for timer ID ${timer.id}:`, error);
                    // Continue with next reminder
                }
            }

            return sentCount;
        } catch (error: any) {
            console.error('Error sending timer reminders:', error);
            throw error;
        }
    }
} 