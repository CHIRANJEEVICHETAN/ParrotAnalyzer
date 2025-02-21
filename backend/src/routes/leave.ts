import express, { Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';
import { calculateLeaveBalances } from './leave-management';

const router = express.Router();

router.use((req, res, next) => {
  console.log('Leave route accessed:', {
    method: req.method,
    path: req.path,
    headers: req.headers
  });
  next();
});

// Get all leave requests for an employee
router.get('/requests', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await client.query(`
      SELECT 
        lr.id,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason,
        lr.status,
        lr.contact_number,
        lr.created_at,
        lr.rejection_reason,
        lt.name as leave_type,
        lt.requires_documentation,
        lt.is_paid,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', ld.id,
            'file_name', ld.file_name,
            'file_type', ld.file_type
          ))
          FROM leave_documents ld
          WHERE ld.request_id = lr.id
          ), '[]'
        ) as documents
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.user_id = $1
      ORDER BY lr.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  } finally {
    client.release();
  }
});

// Get employee's leave balance
router.get('/balance', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // First ensure balances exist for this year
    await calculateLeaveBalances(Number(req.user.id), year);

    const result = await client.query(`
      SELECT 
        lb.id,
        lt.name,
        lt.is_paid,
        lb.total_days,
        lb.used_days,
        lb.pending_days,
        (lb.total_days - lb.used_days - lb.pending_days) as available_days
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = $1 AND lb.year = $2 AND lt.is_active = true
      ORDER BY lt.name
    `, [req.user.id, year]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({ error: 'Failed to fetch leave balance' });
  } finally {
    client.release();
  }
});

// Get leave types with policies
router.get('/types', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        lt.id,
        lt.name,
        lt.description,
        lt.requires_documentation,
        lt.max_days,
        lt.is_paid,
        lp.default_days,
        lp.carry_forward_days,
        lp.min_service_days,
        lp.notice_period_days,
        lp.max_consecutive_days
      FROM leave_types lt
      LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
      WHERE lt.is_active = true
      ORDER BY lt.name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ error: 'Failed to fetch leave types' });
  } finally {
    client.release();
  }
});

// Submit leave request
router.post('/request', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user; // Type assertion here

    const { 
      leave_type_id, 
      start_date, 
      end_date, 
      reason,
      contact_number,
      documents 
    } = req.body;

    await client.query('BEGIN');

    // Get leave type details
    const leaveTypeResult = await client.query(
      'SELECT * FROM leave_types WHERE id = $1',
      [leave_type_id]
    );

    if (!leaveTypeResult.rows.length) {
      throw new Error('Invalid leave type');
    }

    const leaveType = leaveTypeResult.rows[0];

    // Calculate days requested
    const days_requested = Math.ceil(
      (new Date(end_date).getTime() - new Date(start_date).getTime()) / 
      (1000 * 60 * 60 * 24)
    ) + 1;

    // Fetch leave balance for the user
    const balanceResult = await client.query(`
      SELECT lb.total_days, lb.used_days, lb.pending_days
      FROM leave_balances lb
      WHERE lb.user_id = $1 AND lb.leave_type_id = $2
    `, [userId.id, leave_type_id]);

    if (!balanceResult.rows.length) {
      return res.status(400).json({ error: 'No leave balance found for this leave type' });
    }

    const { total_days, used_days, pending_days } = balanceResult.rows[0];
    const available_days = total_days - used_days - pending_days;

    // Validate available days
    if (available_days < days_requested) {
      return res.status(400).json({ error: 'Insufficient leave balance' });
    }

    // Validate maximum consecutive days
    if (days_requested > leaveType.max_consecutive_days) {
      return res.status(400).json({ error: `Cannot request more than ${leaveType.max_consecutive_days} consecutive days` });
    }

    // Insert leave request
    const requestResult = await client.query(`
      INSERT INTO leave_requests (
        user_id,
        leave_type_id,
        start_date,
        end_date,
        days_requested,
        reason,
        contact_number,
        status,
        requires_documentation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
      RETURNING id
    `, [
      userId.id,
      leave_type_id,
      start_date,
      end_date,
      days_requested,
      reason,
      contact_number,
      leaveType.requires_documentation
    ]);

    // Handle document uploads if any
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        await client.query(`
          INSERT INTO leave_documents (
            request_id,
            file_name,
            file_type,
            file_data,
            upload_method
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          requestResult.rows[0].id,
          doc.file_name,
          doc.file_type,
          doc.file_data,
          doc.upload_method
        ]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Leave request submitted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting leave request:', error);
    res.status(500).json({ error: 'Failed to submit leave request' });
  } finally {
    client.release();
  }
});

// Cancel leave request
router.post('/cancel/:id', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Verify ownership and status
    const verifyResult = await client.query(
      'SELECT status FROM leave_requests WHERE id = $1 AND user_id = $2',
      [id, req.user?.id]
    );

    if (!verifyResult.rows.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    if (verifyResult.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Can only cancel pending requests' });
    }

    await client.query(
      'UPDATE leave_requests SET status = $1 WHERE id = $2',
      ['cancelled', id]
    );

    res.json({ message: 'Leave request cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling leave request:', error);
    res.status(500).json({ error: 'Failed to cancel leave request' });
  } finally {
    client.release();
  }
});

// Fetch document by ID
router.get('/document/:id', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const result = await client.query(`
      SELECT file_name, file_type, file_data
      FROM leave_documents WHERE id = $1
    `, [id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  } finally {
    client.release();
  }
});

// Add this near the top of the routes
router.get('/test', authMiddleware, (req: CustomRequest, res: Response) => {
  res.json({ message: 'Leave routes are working' });
});

export default router; 