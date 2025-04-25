import express from 'express';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Redis } from 'ioredis';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Get all active employee locations
router.get('/active-locations', authenticateToken, async (req: any, res) => {
    try {
      // Get all employees under this group admin WITH their details and tracking status
      const employees = await pool.query(
        `SELECT u.id, u.name, u.employee_number, u.department, u.designation,
                CASE 
                    WHEN el.timestamp > NOW() - INTERVAL '5 minutes' AND el.is_tracking_active = true
                    THEN true 
                    ELSE false 
                END as is_tracking_active
         FROM users u
         LEFT JOIN (
             SELECT DISTINCT ON (user_id) 
                user_id, 
                id, 
                timestamp,
                true as is_tracking_active
             FROM employee_locations
             ORDER BY user_id, timestamp DESC
         ) el ON u.id = el.user_id
         WHERE u.group_admin_id = $1 AND u.role = 'employee'
         ORDER BY u.name ASC`,
        [req.user.id]
      );

      // Get device info for employees
      const deviceInfoResults = await pool.query(
        `SELECT dt.user_id, dt.device_type, dt.device_name
         FROM device_tokens dt
         WHERE dt.user_id IN (${employees.rows.map((e) => e.id).join(",")})
         AND dt.is_active = true
         ORDER BY dt.last_used_at DESC`
      );

      // Create a map of user_id to device info
      const deviceInfoMap: Record<number, string> = {};
      deviceInfoResults.rows.forEach((device) => {
        if (!deviceInfoMap[device.user_id]) {
          deviceInfoMap[device.user_id] = `${device.device_name || ""} (${
            device.device_type || "unknown"
          })`;
        }
      });

      // Get cached locations and combine with employee details
      const employeesWithDetails = await Promise.all(
        employees.rows.map(async (emp) => {
          const location = await redis.get(`location:${emp.id}`);
          const locationData = location ? JSON.parse(location) : null;

          return {
            employeeId: emp.id,
            user_name: emp.name,
            employee_number: emp.employee_number,
            department: emp.department,
            designation: emp.designation,
            deviceInfo: deviceInfoMap[emp.id] || "Unknown device",
            isActive: emp.is_tracking_active,
            ...(locationData || {
              latitude: null,
              longitude: null,
              accuracy: null,
              timestamp: null,
              batteryLevel: null,
              isMoving: false,
              lastUpdated: null,
            }),
          };
        })
      );

      res.json(employeesWithDetails);
    } catch (error) {
        console.error('Error fetching employee locations:', error);
        res.status(500).json({ error: 'Failed to fetch employee locations' });
    }
});

// Get employee location history
router.get('/location-history/:employeeId', authenticateToken, async (req: any, res) => {
    try {
        const { employeeId } = req.params;
        const { start_date, end_date } = req.query;

        // Verify this employee belongs to the group admin
        const employee = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND group_admin_id = $2',
            [employeeId, req.user.id]
        );

        if (employee.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            `SELECT * FROM employee_locations 
            WHERE user_id = $1 
            AND timestamp BETWEEN $2 AND $3
            ORDER BY timestamp DESC`,
            [employeeId, start_date, end_date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching location history:', error);
        res.status(500).json({ error: 'Failed to fetch location history' });
    }
});

// Get employee tracking analytics
router.get('/analytics/:employeeId', authenticateToken, async (req: any, res) => {
    try {
        const { employeeId } = req.params;
        const { start_date, end_date } = req.query;

        // Verify this employee belongs to the group admin
        const employee = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND group_admin_id = $2',
            [employeeId, req.user.id]
        );

        if (employee.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            `SELECT * FROM tracking_analytics 
            WHERE user_id = $1 
            AND date BETWEEN $2 AND $3
            ORDER BY date DESC`,
            [employeeId, start_date, end_date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tracking analytics:', error);
        res.status(500).json({ error: 'Failed to fetch tracking analytics' });
    }
});

// Create/Update geofence
router.post('/geofence', authenticateToken, async (req: any, res) => {
    try {
        const { name, coordinates, radius } = req.body;

        // Validate input data
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (!coordinates || !coordinates.type || !coordinates.coordinates) {
            return res.status(400).json({ error: 'Valid GeoJSON coordinates are required' });
        }

        if (coordinates.type !== 'Point') {
            return res.status(400).json({ error: 'Only Point geometry type is supported' });
        }

        if (!radius || isNaN(radius) || radius <= 0) {
            return res.status(400).json({ error: 'Valid radius is required' });
        }

        // Log the data for debugging
        console.log('Creating geofence with data:', {
            companyId: req.user.company_id,
            name,
            coordinates: JSON.stringify(coordinates),
            radius,
            userId: req.user.id
        });

        try {
            const result = await pool.query(
                `INSERT INTO company_geofences 
                (company_id, name, coordinates, radius, created_by)
                VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5)
                RETURNING id, name, ST_AsGeoJSON(coordinates) as coordinates, radius, created_at, updated_at`,
                [req.user.company_id, name, JSON.stringify(coordinates), radius, req.user.id]
            );

            // Format the response to convert the coordinates back to GeoJSON
            const geofence = result.rows[0];
            geofence.coordinates = JSON.parse(geofence.coordinates);

            res.json(geofence);
        } catch (dbError: any) {
            console.error('Database error creating geofence:', dbError);

            // Handle specific database errors
            if (dbError.code === '42P01') {
                return res.status(500).json({
                    error: 'Table does not exist',
                    details: 'The company_geofences table does not exist in the database'
                });
            }

            if (dbError.code === '42883') {
                return res.status(500).json({
                    error: 'Function does not exist',
                    details: 'The ST_GeomFromGeoJSON function is not available. PostGIS extension may not be installed.'
                });
            }

            if (dbError.routine === 'errorMissingColumn') {
                return res.status(500).json({
                    error: 'Column does not exist',
                    details: 'One of the columns in the query does not exist in the table'
                });
            }

            throw dbError; // Re-throw to be caught by the outer catch
        }
    } catch (error: any) {
        console.error('Error creating geofence:', error);

        // Return a more informative error message
        res.status(500).json({
            error: 'Failed to create geofence',
            message: error.message,
            hint: 'Check server logs for more details'
        });
    }
});

// Get all geofences
router.get('/geofences', authenticateToken, async (req: any, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, ST_AsGeoJSON(coordinates) as coordinates, 
            radius, created_at, updated_at
            FROM company_geofences 
            WHERE company_id = $1`,
            [req.user.company_id]
        );

        res.json(result.rows.map(row => ({
            ...row,
            coordinates: JSON.parse(row.coordinates)
        })));
    } catch (error) {
        console.error('Error fetching geofences:', error);
        res.status(500).json({ error: 'Failed to fetch geofences' });
    }
});

// Update geofence
router.put('/geofence/:id', authenticateToken, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { name, coordinates, radius } = req.body;

        // Verify geofence belongs to the company
        const geofence = await pool.query(
            'SELECT id FROM company_geofences WHERE id = $1 AND company_id = $2',
            [id, req.user.company_id]
        );

        if (geofence.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            `UPDATE company_geofences 
            SET name = $1, 
                coordinates = ST_GeomFromGeoJSON($2),
                radius = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *`,
            [name, JSON.stringify(coordinates), radius, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating geofence:', error);
        res.status(500).json({ error: 'Failed to update geofence' });
    }
});

// Delete geofence
router.delete('/geofence/:id', authenticateToken, async (req: any, res) => {
    try {
        const { id } = req.params;

        // Verify geofence belongs to the company
        const geofence = await pool.query(
            'SELECT id FROM company_geofences WHERE id = $1 AND company_id = $2',
            [id, req.user.company_id]
        );

        if (geofence.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await pool.query(
            'DELETE FROM company_geofences WHERE id = $1',
            [id]
        );

        res.json({ message: 'Geofence deleted successfully' });
    } catch (error) {
        console.error('Error deleting geofence:', error);
        res.status(500).json({ error: 'Failed to delete geofence' });
    }
});

// Get company tracking settings
router.get('/tracking-settings', authenticateToken, async (req: any, res) => {
    try {
        // First get the company_id from the user
        const companyResult = await pool.query(
            'SELECT company_id FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (companyResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const company_id = companyResult.rows[0].company_id;

        // Then get the tracking settings
        const result = await pool.query(
            'SELECT * FROM company_tracking_settings WHERE company_id = $1',
            [company_id]
        );
        res.json(result.rows[0] || null);
    } catch (error) {
        console.error('Error fetching tracking settings:', error);
        res.status(500).json({ error: 'Failed to fetch tracking settings' });
    }
});

// Update company tracking settings
router.put('/tracking-settings', authenticateToken, async (req: any, res) => {
    try {
        // First get the company_id from the user
        const companyResult = await pool.query(
            'SELECT company_id FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (companyResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const company_id = companyResult.rows[0].company_id;
        const { 
            update_interval_seconds, 
            battery_saving_enabled, 
            indoor_tracking_enabled,
            default_tracking_precision 
        } = req.body;

        const result = await pool.query(
            `INSERT INTO company_tracking_settings 
             (company_id, update_interval_seconds, battery_saving_enabled, indoor_tracking_enabled, default_tracking_precision)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (company_id) 
             DO UPDATE SET 
               update_interval_seconds = $2,
               battery_saving_enabled = $3,
               indoor_tracking_enabled = $4,
               default_tracking_precision = $5,
               updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [company_id, update_interval_seconds, battery_saving_enabled, indoor_tracking_enabled, default_tracking_precision]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating tracking settings:', error);
        res.status(500).json({ error: 'Failed to update tracking settings' });
    }
});

// Get user tracking permissions
router.get('/tracking-permissions', authenticateToken, async (req: any, res) => {
    try {
        // First get the company_id from the user
        const companyResult = await pool.query(
            'SELECT company_id FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (companyResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const company_id = companyResult.rows[0].company_id;

        // Then get the tracking permissions
        const result = await pool.query(
            `SELECT utp.*, u.name as user_name 
             FROM user_tracking_permissions utp
             JOIN users u ON utp.user_id = u.id
             WHERE u.company_id = $1`,
            [company_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tracking permissions:', error);
        res.status(500).json({ error: 'Failed to fetch tracking permissions' });
    }
});

// Update user tracking permissions
router.put('/tracking-permissions', authenticateToken, async (req: any, res) => {
    try {
        const { user_id, can_override_geofence, tracking_precision } = req.body;
        
        // First get the company_id from the user
        const companyResult = await pool.query(
            'SELECT company_id FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (companyResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const company_id = companyResult.rows[0].company_id;

        // Verify user belongs to company
        const userCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND company_id = $2',
            [user_id, company_id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const result = await pool.query(
            `INSERT INTO user_tracking_permissions 
             (user_id, can_override_geofence, tracking_precision)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) 
             DO UPDATE SET 
               can_override_geofence = $2,
               tracking_precision = $3,
               updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [user_id, can_override_geofence, tracking_precision]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating tracking permissions:', error);
        res.status(500).json({ error: 'Failed to update tracking permissions' });
    }
});

// Get all employees under the group admin with their tracking settings
router.get("/employees", authenticateToken, async (req: any, res) => {
  try {
    // First get the company_id from the user
    const companyResult = await pool.query(
      "SELECT company_id FROM users WHERE id = $1",
      [req.user.id]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const company_id = companyResult.rows[0].company_id;

    // Get all employees under this group admin with their tracking settings
    const result = await pool.query(
      `SELECT 
        u.id as user_id,
        u.name as user_name,
        COALESCE(utp.id, 0) as id,
        COALESCE(utp.can_override_geofence, false) as can_override_geofence,
        COALESCE(utp.tracking_precision, cts.default_tracking_precision) as tracking_precision,
        COALESCE(utp.location_required_for_shift, true) as location_required_for_shift,
        COALESCE(utp.updated_at, CURRENT_TIMESTAMP) as updated_at
      FROM users u
      LEFT JOIN user_tracking_permissions utp ON u.id = utp.user_id
      LEFT JOIN company_tracking_settings cts ON u.company_id = cts.company_id
      WHERE u.company_id = $1 AND u.role = 'employee'
      ORDER BY u.name ASC`,
      [company_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// Update employee tracking settings
router.put("/employee-settings", authenticateToken, async (req: any, res) => {
  try {
    const {
      user_id,
      can_override_geofence,
      tracking_precision,
      location_required_for_shift,
    } = req.body;

    // First get the company_id from the user
    const companyResult = await pool.query(
      "SELECT company_id FROM users WHERE id = $1",
      [req.user.id]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const company_id = companyResult.rows[0].company_id;

    // Verify the target user belongs to the same company
    const userCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND company_id = $2",
      [user_id, company_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Update or insert the tracking settings
    const result = await pool.query(
      `INSERT INTO user_tracking_permissions 
       (user_id, can_override_geofence, tracking_precision, location_required_for_shift)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         can_override_geofence = $2,
         tracking_precision = $3,
         location_required_for_shift = $4,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        user_id,
        can_override_geofence,
        tracking_precision,
        location_required_for_shift,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating employee settings:", error);
    res.status(500).json({ error: "Failed to update employee settings" });
  }
});

export default router; 