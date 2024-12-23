import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

// Apply verifyToken middleware to all routes
router.use(verifyToken);

// Get user's notifications (root route)
router.get('/', async (req: CustomRequest, res: Response) => {
  console.log('GET /api/notifications accessed');
  console.log('Request headers:', req.headers);
  console.log('User from token:', req.user);

  const client = await pool.connect();
  try {
    if (!req.user) {
      console.log('No user found in request');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await client.query(`
      SELECT 
        id,
        title,
        message,
        type,
        read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC`,
      [req.user.id]
    );

    console.log('Query executed successfully');
    console.log('Notifications found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in notifications route:', error);
    res.status(500).json({
      error: 'Failed to fetch notifications',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  } finally {
    client.release();
  }
});

// Test route
router.get('/test', (req: CustomRequest, res: Response) => {
  res.json({ 
    message: 'Notifications router is working',
    user: req.user
  });
});

// Mark notification as read
router.post('/:id/read', async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await client.query(`
      UPDATE notifications
      SET read = true
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  } finally {
    client.release();
  }
});

export default router; 