import express, { Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

// Get pending approvals for the current user
router.get('/pending', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await client.query(`
      WITH user_approval_levels AS (
        SELECT al.id, al.level_order
        FROM approval_levels al
        WHERE al.company_id = (SELECT company_id FROM users WHERE id = $1)
        AND al.role = (SELECT role FROM users WHERE id = $1)
        AND al.is_active = true
      )
      SELECT 
        lr.id as request_id,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason,
        lr.contact_number,
        lr.created_at,
        lr.workflow_id,
        lr.current_level_id,
        lr.approval_status,
        u.name as employee_name,
        u.employee_number,
        u.department,
        lt.name as leave_type,
        lt.requires_documentation,
        lt.is_paid,
        aw.requires_all_levels,
        al.level_name as current_level,
        al.level_order as current_level_order,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', ld.id,
            'file_name', ld.file_name,
            'file_type', ld.file_type
          ))
          FROM leave_documents ld
          WHERE ld.request_id = lr.id
          ), '[]'
        ) as documents,
        json_build_object(
          'total_days', lb.total_days,
          'used_days', lb.used_days,
          'pending_days', lb.pending_days,
          'carry_forward_days', lb.carry_forward_days
        ) as balance_info,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'level_id', ra.level_id,
            'status', ra.status,
            'comments', ra.comments,
            'approver_name', u2.name,
            'approved_at', ra.updated_at
          ) ORDER BY al2.level_order)
          FROM request_approvals ra
          JOIN approval_levels al2 ON ra.level_id = al2.id
          JOIN users u2 ON ra.approver_id = u2.id
          WHERE ra.request_id = lr.id
          ), '[]'
        ) as approval_history
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN approval_workflows aw ON lr.workflow_id = aw.id
      JOIN approval_levels al ON lr.current_level_id = al.id
      LEFT JOIN leave_balances lb ON lr.user_id = lb.user_id 
        AND lr.leave_type_id = lb.leave_type_id 
        AND EXTRACT(YEAR FROM lr.start_date) = lb.year
      WHERE lr.approval_status = 'pending'
      AND lr.current_level_id IN (SELECT id FROM user_approval_levels)
      AND NOT EXISTS (
        SELECT 1 FROM request_approvals ra 
        WHERE ra.request_id = lr.id 
        AND ra.approver_id = $1
      )
      ORDER BY lr.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  } finally {
    client.release();
  }
});

// Process approval/rejection
router.post('/:requestId/:action', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { requestId, action } = req.params;
    const { comments } = req.body;
    const { id: approverId } = req.user!;

    await client.query('BEGIN');

    // Get request details and validate approver's role
    const requestResult = await client.query(`
      SELECT 
        lr.*,
        al.level_order as current_level_order,
        al.role as required_role,
        aw.requires_all_levels,
        u.role as approver_role,
        u.company_id
      FROM leave_requests lr
      JOIN approval_levels al ON lr.current_level_id = al.id
      JOIN approval_workflows aw ON lr.workflow_id = aw.id
      JOIN users u ON u.id = $1
      WHERE lr.id = $2
    `, [approverId, requestId]);

    if (!requestResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const request = requestResult.rows[0];

    if (request.approver_role !== request.required_role) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Unauthorized to process this request' });
    }

    if (request.approval_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Request is not pending approval' });
    }

    // Record the approval/rejection
    await client.query(`
      INSERT INTO request_approvals (
        request_id,
        workflow_id,
        level_id,
        approver_id,
        status,
        comments
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      requestId,
      request.workflow_id,
      request.current_level_id,
      approverId,
      action,
      comments
    ]);

    if (action === 'reject') {
      // Update request status to rejected
      await client.query(`
        UPDATE leave_requests 
        SET 
          approval_status = 'rejected',
          status = 'rejected',
          final_approver_id = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [approverId, requestId]);

      // Update leave balance - remove pending days
      await client.query(`
        UPDATE leave_balances
        SET 
          pending_days = pending_days - $1,
          updated_at = NOW()
        WHERE user_id = $2 
          AND leave_type_id = $3 
          AND year = EXTRACT(YEAR FROM NOW())
      `, [request.days_requested, request.user_id, request.leave_type_id]);
    } else {
      // Get next approval level if any
      const nextLevelResult = await client.query(`
        SELECT al.*
        FROM approval_levels al
        WHERE al.company_id = $1
        AND al.level_order > $2
        AND al.is_active = true
        ORDER BY al.level_order
        LIMIT 1
      `, [request.company_id, request.current_level_order]);

      if (nextLevelResult.rows.length && request.requires_all_levels) {
        // Move to next approval level
        await client.query(`
          UPDATE leave_requests 
          SET 
            current_level_id = $1,
            updated_at = NOW()
          WHERE id = $2
        `, [nextLevelResult.rows[0].id, requestId]);
      } else {
        // Final approval
        await client.query(`
          UPDATE leave_requests 
          SET 
            approval_status = 'approved',
            status = 'approved',
            final_approver_id = $1,
            updated_at = NOW()
          WHERE id = $2
        `, [approverId, requestId]);

        // Update leave balance - move days from pending to used
        await client.query(`
          UPDATE leave_balances
          SET 
            used_days = used_days + $1,
            pending_days = pending_days - $1,
            updated_at = NOW()
          WHERE user_id = $2 
            AND leave_type_id = $3 
            AND year = EXTRACT(YEAR FROM NOW())
        `, [request.days_requested, request.user_id, request.leave_type_id]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Leave request processed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing leave request:', error);
    res.status(500).json({ error: 'Failed to process leave request' });
  } finally {
    client.release();
  }
});

// Get approval history for a request
router.get('/:requestId/history', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { requestId } = req.params;
    const { id: userId } = req.user!;

    // Verify user has access to this request
    const accessResult = await client.query(`
      SELECT 1
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1
      AND (
        lr.user_id = $2
        OR u.group_admin_id = $2
        OR (
          SELECT role FROM users WHERE id = $2
        ) IN ('management', 'super_admin')
      )
    `, [requestId, userId]);

    if (!accessResult.rows.length) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await client.query(`
      SELECT 
        ra.id,
        ra.status,
        ra.comments,
        ra.created_at,
        ra.updated_at,
        u.name as approver_name,
        u.role as approver_role,
        al.level_name,
        al.level_order
      FROM request_approvals ra
      JOIN users u ON ra.approver_id = u.id
      JOIN approval_levels al ON ra.level_id = al.id
      WHERE ra.request_id = $1
      ORDER BY al.level_order, ra.created_at
    `, [requestId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({ error: 'Failed to fetch approval history' });
  } finally {
    client.release();
  }
});

// Get approval workflow configuration
router.get('/workflows', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: userId } = req.user!;

    // Get user's company ID
    const userResult = await client.query(
      `SELECT company_id FROM users WHERE id = $1`,
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const companyId = userResult.rows[0].company_id;

    const result = await client.query(`
      SELECT 
        aw.*,
        lt.name as leave_type_name,
        json_agg(
          json_build_object(
            'level_id', al.id,
            'level_name', al.level_name,
            'level_order', al.level_order,
            'role', al.role,
            'is_required', wl.is_required
          ) ORDER BY al.level_order
        ) as approval_levels
      FROM approval_workflows aw
      JOIN leave_types lt ON aw.leave_type_id = lt.id
      JOIN workflow_levels wl ON aw.id = wl.workflow_id
      JOIN approval_levels al ON wl.level_id = al.id
      WHERE aw.company_id = $1
      AND aw.is_active = true
      GROUP BY aw.id, lt.name
      ORDER BY lt.name
    `, [companyId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching approval workflows:', error);
    res.status(500).json({ error: 'Failed to fetch approval workflows' });
  } finally {
    client.release();
  }
});

export default router; 