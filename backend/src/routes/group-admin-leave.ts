import { Router, Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = Router();

// Get all leave requests for employees under a group admin
router.get('/leave-requests', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: groupAdminId } = req.user!;

    // Get company_id for validation
    const userResult = await client.query(
      `SELECT company_id FROM users WHERE id = $1`,
      [groupAdminId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const companyId = userResult.rows[0].company_id;

    const result = await client.query(`
      SELECT 
        lr.*,
        u.name as user_name,
        u.employee_number,
        u.department,
        lt.name as leave_type_name,
        lt.requires_documentation,
        lt.is_paid,
        ld.id as document_id,
        ld.file_name,
        ld.file_type,
        ld.file_data,
        ld.upload_method,
        json_build_object(
          'total_days', lb.total_days,
          'used_days', lb.used_days,
          'pending_days', lb.pending_days,
          'carry_forward_days', lb.carry_forward_days
        ) as balance_info
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_documents ld ON lr.id = ld.request_id
      LEFT JOIN leave_balances lb ON lr.user_id = lb.user_id 
        AND lr.leave_type_id = lb.leave_type_id 
        AND EXTRACT(YEAR FROM lr.start_date) = lb.year
      WHERE u.group_admin_id = $1 
        AND lt.company_id = $2 
        AND lr.status = 'pending'
      ORDER BY lr.created_at DESC
    `, [groupAdminId, companyId]);

    // Group documents by request
    const requests = result.rows.reduce((acc: any[], row) => {
      const existingRequest = acc.find(r => r.id === row.id);
      if (existingRequest) {
        if (row.document_id) {
          existingRequest.documents.push({
            id: row.document_id,
            file_name: row.file_name,
            file_type: row.file_type,
            file_data: row.file_data,
            upload_method: row.upload_method
          });
        }
        return acc;
      }

      const documents = row.document_id ? [{
        id: row.document_id,
        file_name: row.file_name,
        file_type: row.file_type,
        file_data: row.file_data,
        upload_method: row.upload_method
      }] : [];

      const {
        document_id, file_name, file_type, file_data, upload_method,
        balance_info,
        ...requestData
      } = row;

      return [...acc, { 
        ...requestData, 
        documents,
        balance_info: balance_info || {
          total_days: 0,
          used_days: 0,
          pending_days: 0,
          carry_forward_days: 0
        }
      }];
    }, []);

    res.json(requests);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({
      error: 'Failed to fetch leave requests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get leave request statistics
router.get('/leave-statistics', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: groupAdminId } = req.user!;

    const result = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE lr.status = 'pending') as pending_requests,
        COUNT(*) FILTER (WHERE lr.status = 'approved') as approved_requests,
        COUNT(*) FILTER (WHERE lr.status = 'rejected') as rejected_requests,
        COUNT(DISTINCT lr.user_id) as total_employees_on_leave,
        COALESCE(SUM(lr.days_requested) FILTER (WHERE lr.status = 'approved'), 0) as total_approved_days
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE u.group_admin_id = $1
      AND lr.created_at >= NOW() - INTERVAL '30 days'
    `, [groupAdminId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching leave statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch leave statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Process leave request (approve/reject/escalate)
router.post('/leave-requests/:requestId/:action', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { requestId, action } = req.params;
    const { rejection_reason, escalation_reason } = req.body;
    const { id: groupAdminId } = req.user!;

    // Get company_id for validation
    const userResult = await client.query(
      `SELECT company_id FROM users WHERE id = $1`,
      [groupAdminId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const companyId = userResult.rows[0].company_id;

    // Verify the request belongs to an employee under this group admin
    const verifyResult = await client.query(`
      SELECT lr.*, lt.company_id as leave_type_company_id
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = $1 AND u.group_admin_id = $2 AND lt.company_id = $3
    `, [requestId, groupAdminId, companyId]);

    if (!verifyResult.rows.length) {
      return res.status(404).json({ error: 'Leave request not found or unauthorized' });
    }

    const request = verifyResult.rows[0];
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Can only process pending requests' });
    }

    if (action === 'reject' && !rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    await client.query('BEGIN');

    // Update request status
    await client.query(`
      UPDATE leave_requests 
      SET 
        status = $1,
        rejection_reason = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [
      action === 'approve' ? 'approved' : 
      action === 'reject' ? 'rejected' : 
      action === 'escalate' ? 'escalated' : action, 
      rejection_reason || null, 
      requestId
    ]);

    // Update leave balance based on action
    if (action === 'approve') {
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
    } else if (action === 'reject') {
      await client.query(`
        UPDATE leave_balances
        SET 
          pending_days = pending_days - $1,
          updated_at = NOW()
        WHERE user_id = $2 
          AND leave_type_id = $3 
          AND year = EXTRACT(YEAR FROM NOW())
      `, [request.days_requested, request.user_id, request.leave_type_id]);
    } else if (action === 'escalate') {
      if (!escalation_reason) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Escalation reason is required' });
      }

      // Find a management user to escalate to
      const managementResult = await client.query(`
        SELECT id 
        FROM users 
        WHERE role = 'management' 
        AND company_id = $1
        LIMIT 1
      `, [companyId]);

      if (!managementResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'No management user found to escalate to' });
      }

      const managementId = managementResult.rows[0].id;

      await client.query(`
        INSERT INTO leave_escalations (
          request_id,
          escalated_by,
          escalated_to,
          reason,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, 'pending', NOW())
      `, [requestId, groupAdminId, managementId, escalation_reason]);
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

// Get active leave types (read-only)
router.get(
  "/leave-types",
  [authMiddleware, adminMiddleware],
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id: userId } = req.user!;

      // Get the group admin's company ID
      const userResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [userId]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;

      // Get active leave types for this company with default balances for group-admin role
      const result = await client.query(
        `SELECT 
          lt.*,
          cdb.default_days,
          cdb.carry_forward_days
        FROM leave_types lt
        LEFT JOIN company_default_leave_balances cdb ON lt.id = cdb.leave_type_id
          AND cdb.role = 'group_admin'
        WHERE lt.company_id = $1 
          AND lt.is_active = true
        ORDER BY lt.name`,
        [companyId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching leave types:", error);
      res.status(500).json({
        error: "Failed to fetch leave types",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      client.release();
    }
  }
);

// Get leave policies (read-only)
router.get(
  "/leave-policies",
  [authMiddleware, adminMiddleware],
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id: userId } = req.user!;

      // Get the group admin's company ID
      const userResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [userId]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;

      // Get active policies for this company
      const result = await client.query(
        `SELECT 
          lp.*, 
          lt.name as leave_type_name,
          cdb.default_days as role_default_days,
          cdb.carry_forward_days as role_carry_forward_days
        FROM leave_policies lp
        JOIN leave_types lt ON lp.leave_type_id = lt.id
        LEFT JOIN company_default_leave_balances cdb ON lt.id = cdb.leave_type_id
          AND cdb.role = 'group_admin'
        WHERE lt.company_id = $1
          AND lt.is_active = true
        ORDER BY lt.name`,
        [companyId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching leave policies:", error);
      res.status(500).json({
        error: "Failed to fetch leave policies",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      client.release();
    }
  }
);

// Get employee leave balances
router.get(
  "/employee-leave-balances",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.query.userId
        ? parseInt(req.query.userId as string)
        : null;
      const year =
        parseInt(req.query.year as string) || new Date().getFullYear();

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Check if the employee is under this group admin and get company_id
      const employeeCheck = await client.query(
        `SELECT id, company_id FROM users WHERE id = $1 AND group_admin_id = $2`,
        [userId, req.user.id]
      );

      if (!employeeCheck.rows.length) {
        return res.status(403).json({
          error: "Access denied",
          details: "This employee is not under your management",
        });
      }

      const companyId = employeeCheck.rows[0].company_id;

      // Get leave balances with company-specific leave types
      const result = await client.query(
        `SELECT 
          lb.id,
          lt.id as leave_type_id,
          lt.name,
          lt.is_paid,
          lb.total_days,
          lb.used_days,
          lb.pending_days,
          lb.carry_forward_days,
          (lb.total_days + COALESCE(lb.carry_forward_days, 0) - lb.used_days - lb.pending_days) as available_days,
          lt.max_days,
          lt.requires_documentation,
          cdb.default_days as role_default_days,
          cdb.carry_forward_days as role_carry_forward_days
        FROM leave_types lt
        LEFT JOIN leave_balances lb ON lt.id = lb.leave_type_id 
          AND lb.user_id = $1 
          AND lb.year = $2
        LEFT JOIN company_default_leave_balances cdb ON lt.id = cdb.leave_type_id
          AND cdb.role = 'employee'
        WHERE lt.company_id = $3
          AND lt.is_active = true
        ORDER BY lt.name`,
        [userId, year, companyId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching employee leave balances:", error);
      res.status(500).json({
        error: "Failed to fetch employee leave balances",
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      client.release();
    }
  }
);

export default router;
