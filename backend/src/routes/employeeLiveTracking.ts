import express from 'express';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Redis } from 'ioredis';
import locationTrackingController from "../controllers/locationTrackingController";

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Store location update
router.post(
  "/location",
  authenticateToken,
  locationTrackingController.storeLocation
);

// Special route for background location updates - more forgiving validation
router.post(
  "/background-location",
  authenticateToken,
  locationTrackingController.storeBackgroundLocation
);

// General update endpoint for background location tracking tasks
router.post(
  "/update",
  authenticateToken,
  async (req: any, res) => {
    try {
      console.log("[/update] Received location update from background task");
      
      // Mark the request as coming from a background task
      req.headers['x-background-update'] = 'true';
      
      // Add resilience for background updates
      if (!req.body) {
        console.error("[/update] No body received in request");
        return res.status(200).json({
          success: false,
          message: "No location data provided",
          timestamp: new Date()
        });
      }
      
      // Log the update for debugging
      console.log("[/update] Location data received:", {
        userId: req.user?.id,
        coords: req.body.latitude && req.body.longitude 
          ? `${req.body.latitude.toFixed(6)},${req.body.longitude.toFixed(6)}`
          : 'Invalid coordinates',
        accuracy: req.body.accuracy,
        timestamp: req.body.timestamp,
        isBackground: true,
        batteryLevel: req.body.batteryLevel,
        isMoving: req.body.isMoving
      });
      
      // Add background flag to the request body
      req.body.isBackground = true;
      
      // Forward to the background location handler
      return locationTrackingController.storeBackgroundLocation(req, res);
    } catch (error: any) {
      console.error("[/update] Error processing background update:", error);
      
      // Always return 200 for background tasks to prevent retry cycles
      return res.status(200).json({
        success: false,
        message: "Error processing location update",
        error: error.message || "Unknown error",
        timestamp: new Date()
      });
    }
  }
);

// Get current user's tracking permissions
router.get('/tracking-permissions', authenticateToken, async (req: any, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM user_tracking_permissions WHERE user_id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            // Create default permissions if none exist
            const defaultPermissions = await pool.query(
                `INSERT INTO user_tracking_permissions 
                (user_id, can_override_geofence, tracking_precision)
                VALUES ($1, false, 'high')
                RETURNING *`,
                [req.user.id]
            );
            return res.json(defaultPermissions.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching tracking permissions:', error);
        res.status(500).json({ error: 'Failed to fetch tracking permissions' });
    }
});

// Get company tracking settings
router.get('/company-settings', authenticateToken, async (req: any, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM company_tracking_settings WHERE company_id = $1',
            [req.user.company_id]
        );

        if (result.rows.length === 0) {
            // Create default settings if none exist
            const defaultSettings = await pool.query(
                `INSERT INTO company_tracking_settings 
                (company_id, min_location_accuracy, update_interval_seconds)
                VALUES ($1, 50, 30)
                RETURNING *`,
                [req.user.company_id]
            );
            return res.json(defaultSettings.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching company settings:', error);
        res.status(500).json({ error: 'Failed to fetch company settings' });
    }
});

// Get user's current location from cache
router.get('/current-location', authenticateToken, async (req: any, res) => {
    try {
        const location = await redis.get(`location:${req.user.id}`);
        if (!location) {
            return res.status(404).json({ error: 'No recent location found' });
        }
        res.json(JSON.parse(location));
    } catch (error) {
        console.error('Error fetching current location:', error);
        res.status(500).json({ error: 'Failed to fetch current location' });
    }
});

// Get user's location history
router.get('/location-history', authenticateToken, async (req: any, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        const result = await pool.query(
            `SELECT * FROM employee_locations 
            WHERE user_id = $1 
            AND timestamp BETWEEN $2 AND $3
            ORDER BY timestamp DESC`,
            [req.user.id, start_date, end_date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching location history:', error);
        res.status(500).json({ error: 'Failed to fetch location history' });
    }
});

// Get user's tracking analytics
router.get('/analytics', authenticateToken, async (req: any, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        const result = await pool.query(
            `SELECT * FROM tracking_analytics 
            WHERE user_id = $1 
            AND date BETWEEN $2 AND $3
            ORDER BY date DESC`,
            [req.user.id, start_date, end_date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tracking analytics:', error);
        res.status(500).json({ error: 'Failed to fetch tracking analytics' });
    }
});

// Update user's tracking permissions
router.put('/tracking-permissions', authenticateToken, async (req: any, res) => {
    try {
        const { tracking_precision } = req.body;
        
        const result = await pool.query(
            `UPDATE user_tracking_permissions 
            SET tracking_precision = $1, 
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING *`,
            [tracking_precision, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tracking permissions not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating tracking permissions:', error);
        res.status(500).json({ error: 'Failed to update tracking permissions' });
    }
});

export default router; 