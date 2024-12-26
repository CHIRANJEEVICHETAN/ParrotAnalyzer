import express, { Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

router.use((req, res, next) => {
  console.log('Leave route accessed:', {
    method: req.method,
    path: req.path,
    body: req.body,
    headers: req.headers
  });
  next();
});

// Leave routes for employees
router.get('/leave/balance', authMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    console.log('Fetching leave balance for user:', req.user?.id);
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    
    // First get the user's group admin id
    const userResult = await pool.query(
      'SELECT group_admin_id FROM users WHERE id = $1',
      [userId]
    );

    console.log('User query result:', userResult.rows);

    if (!userResult.rows[0]?.group_admin_id) {
      console.log('No group admin found for user:', userId);
      return res.status(404).json({ error: 'No group admin found for user' });
    }

    const groupAdminId = userResult.rows[0].group_admin_id;
    console.log('Found group admin id:', groupAdminId);

    // Then get the leave balance for that group
    const balance = await pool.query(
      'SELECT casual_leave, sick_leave, annual_leave FROM leave_balances WHERE group_admin_id = $1',
      [groupAdminId]
    );

    console.log('Leave balance query result:', balance.rows);

    // If no balance is set, return defaults
    if (balance.rows.length === 0) {
      console.log('No balance found, creating default balance');
      // Insert default values
      const defaultBalance = await pool.query(
        `INSERT INTO leave_balances 
         (group_admin_id, casual_leave, sick_leave, annual_leave)
         VALUES ($1, 10, 7, 14)
         RETURNING casual_leave, sick_leave, annual_leave`,
        [groupAdminId]
      );
      console.log('Created default balance:', defaultBalance.rows[0]);
      return res.json(defaultBalance.rows[0]);
    }

    res.json(balance.rows[0]);
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({ error: 'Failed to fetch leave balance' });
  }
});

router.post('/leave/request', authMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const { leaveType, startDate, endDate, reason, contactNumber } = req.body;

    // Get user's group admin id
    const userResult = await pool.query(
      'SELECT group_admin_id FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.group_admin_id) {
      return res.status(400).json({ error: 'No group admin found for user' });
    }

    const groupAdminId = userResult.rows[0].group_admin_id;
    
    await pool.query(
      `INSERT INTO leave_requests 
       (user_id, group_admin_id, leave_type, start_date, end_date, reason, contact_number) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, groupAdminId, leaveType, startDate, endDate, reason, contactNumber]
    );
    
    res.json({ message: 'Leave request submitted successfully' });
  } catch (error) {
    console.error('Error submitting leave request:', error);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
});

// Leave management routes for group admin
router.get('/admin/leave-requests', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;
    const requests = await pool.query(
      `SELECT 
        lr.*,
        u.name as user_name,
        u.employee_number,
        u.department 
       FROM leave_requests lr 
       JOIN users u ON lr.user_id = u.id 
       WHERE lr.group_admin_id = $1 
       ORDER BY lr.created_at DESC`,
      [adminId]
    );
    res.json(requests.rows);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

router.post('/admin/leave-requests/:id/:action', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const { action } = req.params;
  
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.id;
    
    // First verify this leave request belongs to this admin
    const verifyRequest = await pool.query(
      'SELECT id FROM leave_requests WHERE id = $1 AND group_admin_id = $2',
      [id, adminId]
    );

    if (verifyRequest.rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    await pool.query(
      'UPDATE leave_requests SET status = $1, rejection_reason = $2 WHERE id = $3',
      [action === 'approve' ? 'approved' : 'rejected', rejectionReason, id]
    );
    
    // Create notification for the user
    const request = await pool.query('SELECT user_id FROM leave_requests WHERE id = $1', [id]);
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [
        request.rows[0].user_id,
        `Leave Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        action === 'approve' 
          ? 'Your leave request has been approved'
          : `Your leave request has been rejected. Reason: ${rejectionReason}`,
        'leave'
      ]
    );
    
    res.json({ message: `Leave request ${action}ed successfully` });
  } catch (error) {
    console.error('Error updating leave request:', error);
    res.status(500).json({ error: `Failed to ${action} leave request` });
  }
});

// Update the admin leave balance route
router.get('/admin/leave-balance', authMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;
    
    const balance = await pool.query(
      'SELECT casual_leave, sick_leave, annual_leave FROM leave_balances WHERE group_admin_id = $1',
      [adminId]
    );

    if (balance.rows.length === 0) {
      // Insert default values if none exist
      const defaultBalance = await pool.query(
        `INSERT INTO leave_balances 
         (group_admin_id, casual_leave, sick_leave, annual_leave)
         VALUES ($1, 10, 7, 14)
         RETURNING casual_leave, sick_leave, annual_leave`,
        [adminId]
      );
      return res.json(defaultBalance.rows[0]);
    }

    res.json(balance.rows[0]);
  } catch (error) {
    console.error('Error fetching admin leave balance:', error);
    res.status(500).json({ error: 'Failed to fetch leave balance' });
  }
});

// Update the admin leave balance update route
router.put('/admin/leave-balance', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;
    const { casual, sick, annual } = req.body;

    // Validate input
    if (!casual || !sick || !annual || 
        isNaN(casual) || isNaN(sick) || isNaN(annual)) {
      return res.status(400).json({ 
        error: 'Invalid input. All values must be numbers.' 
      });
    }

    console.log('Updating leave balance:', {
      adminId,
      casual,
      sick,
      annual
    });

    // First try to update existing record
    let result = await pool.query(
      `UPDATE leave_balances 
       SET 
         casual_leave = $2,
         sick_leave = $3,
         annual_leave = $4,
         updated_at = CURRENT_TIMESTAMP
       WHERE group_admin_id = $1
       RETURNING casual_leave, sick_leave, annual_leave`,
      [adminId, casual, sick, annual]
    );

    // If no record was updated, insert a new one
    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO leave_balances 
         (group_admin_id, casual_leave, sick_leave, annual_leave)
         VALUES ($1, $2, $3, $4)
         RETURNING casual_leave, sick_leave, annual_leave`,
        [adminId, casual, sick, annual]
      );
    }

    console.log('Update result:', result.rows[0]);

    if (!result.rows.length) {
      throw new Error('No rows returned after update/insert');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Detailed error updating leave balance:', error);
    res.status(500).json({ 
      error: 'Failed to update leave balance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 