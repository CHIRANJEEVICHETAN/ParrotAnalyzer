import { pool } from '../config/database';
import { GeofenceManagementService } from './GeofenceManagementService';

export class ShiftTrackingService {
    private geofenceService: GeofenceManagementService;

    constructor() {
        this.geofenceService = new GeofenceManagementService();
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
} 