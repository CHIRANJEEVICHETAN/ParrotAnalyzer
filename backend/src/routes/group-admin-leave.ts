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

    const result = await client.query(`
      SELECT 
        lr.*,
        u.name as user_name,
        u.employee_number,
        u.department,
        lt.name as leave_type_name,
        lt.requires_documentation,
        ld.id as document_id,
        ld.file_name,
        ld.file_type,
        ld.file_data,
        ld.upload_method
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_documents ld ON lr.id = ld.request_id
      WHERE u.group_admin_id = $1 AND lr.status = 'pending'
      ORDER BY lr.created_at DESC
    `, [groupAdminId]);

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
        ...requestData
      } = row;

      return [...acc, { ...requestData, documents }];
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
        COUNT(*) FILTER (WHERE lr.status = 'rejected') as rejected_requests
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

// Process leave request (approve/reject)
router.post('/leave-requests/:requestId/:action', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { requestId, action } = req.params;
    const { rejection_reason } = req.body;
    const { id: groupAdminId } = req.user!;

    // Verify the request belongs to an employee under this group admin
    const verifyResult = await client.query(`
      SELECT lr.* 
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1 AND u.group_admin_id = $2
    `, [requestId, groupAdminId]);

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

    // Begin transaction
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

    // If approved, update leave balance
    if (action === 'approve') {
      await client.query(`
        UPDATE leave_balances
        SET 
          used_days = used_days + $1,
          pending_days = pending_days - $1,
          updated_at = NOW()
        WHERE user_id = $2 AND leave_type_id = $3 AND year = EXTRACT(YEAR FROM NOW())
      `, [request.days_requested, request.user_id, request.leave_type_id]);
    }

    // If escalated, create escalation record
    if (action === 'escalate') {
      const { escalation_reason, escalated_to } = req.body;
      if (!escalation_reason) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Escalation reason is required' });
      }

      // If escalated_to is not provided, find a management user
      let targetManagerId = escalated_to;
      if (!targetManagerId) {
        const managementResult = await client.query(`
          SELECT id 
          FROM users 
          WHERE role = 'management' 
          AND company_id = (
            SELECT company_id 
            FROM users 
            WHERE id = $1
          )
          LIMIT 1
        `, [request.user_id]);

        if (!managementResult.rows.length) {
          await client.query('ROLLBACK');
          return res.status(500).json({ error: 'No management user found to escalate to' });
        }

        targetManagerId = managementResult.rows[0].id;
      }

      await client.query(`
        INSERT INTO leave_escalations (
          request_id,
          escalated_by,
          escalated_to,
          reason,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, 'pending', NOW())
      `, [requestId, groupAdminId, targetManagerId, escalation_reason]);
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

// Escalate leave request to management
router.post('/leave-requests/:requestId/escalate', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const { id: groupAdminId } = req.user!;

    if (!reason) {
      return res.status(400).json({ error: 'Escalation reason is required' });
    }

    // Verify the request belongs to an employee under this group admin
    const verifyResult = await client.query(`
      SELECT lr.*, u.company_id
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1 AND u.group_admin_id = $2
      AND lr.status = 'pending'
    `, [requestId, groupAdminId]);

    if (!verifyResult.rows.length) {
      return res.status(404).json({ error: 'Leave request not found, unauthorized, or not in pending status' });
    }

    const request = verifyResult.rows[0];

    // Find a management user to escalate to
    const managementResult = await client.query(`
      SELECT id 
      FROM users 
      WHERE role = 'management' 
      AND company_id = $1 
      LIMIT 1
    `, [request.company_id]);

    if (!managementResult.rows.length) {
      return res.status(500).json({ error: 'No management user found' });
    }

    const managementUserId = managementResult.rows[0].id;

    // Begin transaction
    await client.query('BEGIN');

    // Update request status to 'escalated'
    await client.query(`
      UPDATE leave_requests 
      SET 
        status = 'escalated',
        updated_at = NOW(),
        group_admin_id = $2
      WHERE id = $1
    `, [requestId, groupAdminId]);

    // Create escalation record
    await client.query(`
      INSERT INTO leave_escalations (
        request_id,
        escalated_by,
        escalated_to,
        reason,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, 'pending', NOW())
    `, [requestId, groupAdminId, managementUserId, reason]);

    await client.query('COMMIT');
    res.json({ message: 'Leave request escalated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error escalating leave request:', error);
    res.status(500).json({ 
      error: 'Failed to escalate leave request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get group admin's own leave requests
router.get('/my-requests', [authMiddleware, adminMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: userId } = req.user!;

    const result = await client.query(`
      SELECT 
        lr.*,
        lt.name as leave_type_name,
        lt.requires_documentation,
        ld.id as document_id,
        ld.file_name,
        ld.file_type,
        ld.file_data,
        ld.upload_method
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_documents ld ON lr.id = ld.request_id
      WHERE lr.user_id = $1
      ORDER BY lr.created_at DESC
    `, [userId]);

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
        ...requestData
      } = row;

      return [...acc, { ...requestData, documents }];
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

// Get my leave balances with proper management configurations
router.get(
  "/my-balances",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const year =
        parseInt(req.query.year as string) || new Date().getFullYear();

      // Get company ID
      const userResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;

      // Fetch all active leave types with policies for this company (both global and company-specific)
      const leaveTypesResult = await client.query(
        `
        SELECT 
          lt.id,
          lt.name,
          lt.is_paid,
          lt.requires_documentation,
          lt.is_active,
          lt.company_id,
          lt.max_days,
          COALESCE(lp.default_days, lt.max_days) as default_days,
          COALESCE(lp.carry_forward_days, 0) as carry_forward_days,
          COALESCE(lp.min_service_days, 0) as min_service_days,
          COALESCE(lp.notice_period_days, 0) as notice_period_days,
          COALESCE(lp.max_consecutive_days, lt.max_days) as max_consecutive_days,
          lp.gender_specific
        FROM leave_types lt
        LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
        WHERE lt.is_active = true
        AND (lt.company_id IS NULL OR lt.company_id = $1)
        ORDER BY lt.name
        `,
        [companyId]
      );

      if (!leaveTypesResult.rows.length) {
        return res
          .status(404)
          .json({ error: "No active leave types found for your company" });
      }

      // Begin transaction for potential balance initialization
      await client.query("BEGIN");

      // Get existing leave balances for the user
      const existingBalancesResult = await client.query(
        `
        SELECT leave_type_id
        FROM leave_balances
        WHERE user_id = $1 AND year = $2
        `,
        [req.user.id, year]
      );
      
      const existingLeaveTypeIds = existingBalancesResult.rows.map(row => row.leave_type_id);
      
      // For each leave type, check if a balance record exists, if not, create one
      for (const leaveType of leaveTypesResult.rows) {
        if (!existingLeaveTypeIds.includes(leaveType.id)) {
          // This is a new leave type, create a balance record
          const defaultDays = leaveType.default_days || 0;

          await client.query(
            `
            INSERT INTO leave_balances (
              user_id,
              leave_type_id,
              total_days,
              used_days,
              pending_days,
              year,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, 0, 0, $4, NOW(), NOW())
            `,
            [req.user.id, leaveType.id, defaultDays, year]
          );
          
          console.log(
            `Initialized leave balance for new leave type ${leaveType.id} for user ${req.user.id}`
          );
        }
      }

      // Now fetch all leave balances, including newly created ones
      const result = await client.query(
        `
        SELECT 
          lb.id,
          lt.id as leave_type_id,
          lt.name,
          lt.is_paid,
          lb.total_days,
          lb.used_days,
          lb.pending_days,
          lb.carry_forward_days,
          (lb.total_days + COALESCE(lb.carry_forward_days, 0) - lb.used_days - lb.pending_days) as available_days
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.user_id = $1 AND lb.year = $2 
        AND lt.is_active = true
        AND (lt.company_id IS NULL OR lt.company_id = $3)
        ORDER BY lt.name
        `,
        [req.user.id, year, companyId]
      );

      await client.query("COMMIT");
      res.json(result.rows);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error fetching leave balance:", error);
      res.status(500).json({
        error: "Failed to fetch leave balance",
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      client.release();
    }
  }
);

// Get active leave types
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

      // Get active leave types for this company
      const leaveTypesResult = await client.query(
        `SELECT 
          lt.id,
          lt.name,
          lt.description,
          lt.requires_documentation,
          lt.max_days,
          lt.is_paid,
          lt.is_active,
          lt.max_days as default_days
        FROM leave_types lt
        WHERE lt.is_active = true
        AND (lt.company_id IS NULL OR lt.company_id = $1)
        ORDER BY lt.name`,
        [companyId]
      );

      res.json(leaveTypesResult.rows);
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

// Get active leave policies
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

      // Get active policies, prioritizing company-specific ones
      const result = await client.query(
        `
      SELECT 
        lp.*, 
        lt.name as leave_type_name
      FROM leave_policies lp
      JOIN leave_types lt ON lp.leave_type_id = lt.id
      WHERE lt.is_active = true
      AND (lt.company_id IS NULL OR lt.company_id = $1)
      ORDER BY lt.name
    `,
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

// Fetch employee leave balances with proper management configurations
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

      // Check if the employee is under this group admin
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

      // Fetch all active leave types with policies for this company
      const leaveTypesResult = await client.query(
        `
        SELECT 
          lt.id,
          lt.name,
          lt.is_paid,
          lt.requires_documentation,
          lt.is_active,
          lt.company_id,
          lt.max_days,
          COALESCE(lp.default_days, lt.max_days) as default_days,
          COALESCE(lp.carry_forward_days, 0) as carry_forward_days,
          COALESCE(lp.min_service_days, 0) as min_service_days,
          COALESCE(lp.notice_period_days, 0) as notice_period_days,
          COALESCE(lp.max_consecutive_days, lt.max_days) as max_consecutive_days,
          lp.gender_specific
        FROM leave_types lt
        LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
        WHERE lt.is_active = true
        AND (lt.company_id IS NULL OR lt.company_id = $1)
        ORDER BY lt.name
        `,
        [companyId]
      );

      if (!leaveTypesResult.rows.length) {
        return res
          .status(404)
          .json({ error: "No active leave types found for your company" });
      }

      // Begin transaction for potential balance initialization
      await client.query("BEGIN");

      // Get existing leave balances for the user
      const existingBalancesResult = await client.query(
        `
        SELECT leave_type_id
        FROM leave_balances
        WHERE user_id = $1 AND year = $2
        `,
        [userId, year]
      );
      
      const existingLeaveTypeIds = existingBalancesResult.rows.map(row => row.leave_type_id);
      
      // For each leave type, check if a balance record exists, if not, create one
      for (const leaveType of leaveTypesResult.rows) {
        if (!existingLeaveTypeIds.includes(leaveType.id)) {
          // This is a new leave type, create a balance record
          const defaultDays = leaveType.default_days || 0;

          await client.query(
            `
            INSERT INTO leave_balances (
              user_id,
              leave_type_id,
              total_days,
              used_days,
              pending_days,
              year,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, 0, 0, $4, NOW(), NOW())
            `,
            [userId, leaveType.id, defaultDays, year]
          );
          
          console.log(
            `Initialized leave balance for new leave type ${leaveType.id} for user ${userId}`
          );
        }
      }

      // Now fetch all leave balances, including newly created ones
      const result = await client.query(
        `
        SELECT 
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
          lt.requires_documentation
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.user_id = $1 AND lb.year = $2 
        AND lt.is_active = true
        AND (lt.company_id IS NULL OR lt.company_id = $3)
        ORDER BY lt.name
        `,
        [userId, year, companyId]
      );

      await client.query("COMMIT");
      res.json(result.rows);
    } catch (error) {
      await client.query("ROLLBACK");
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

// Submit a new leave request
router.post(
  "/request",
  [authMiddleware, adminMiddleware],
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id: userId } = req.user!;
      const {
        leave_type_id,
        start_date,
        end_date,
        reason,
        contact_number,
        documents = [],
      } = req.body;

      // Validate required fields
      if (
        !leave_type_id ||
        !start_date ||
        !end_date ||
        !reason ||
        !contact_number
      ) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Begin transaction
      await client.query("BEGIN");

      // Get user information
      const userResult = await client.query(
        "SELECT gender, company_id FROM users WHERE id = $1",
        [userId]
      );

      if (!userResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      const userGender = userResult.rows[0]?.gender;
      const companyId = userResult.rows[0]?.company_id;

      // Get leave type details
      const leaveTypeResult = await client.query(
        `SELECT lt.* FROM leave_types lt
         WHERE lt.id = $1 AND lt.is_active = true`,
        [leave_type_id]
      );

      if (!leaveTypeResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid leave type" });
      }

      const leaveType = leaveTypeResult.rows[0];

      // Get leave policy details
      const policyResult = await client.query(
        `SELECT * FROM leave_policies
         WHERE leave_type_id = $1`,
        [leave_type_id]
      );

      const policyExists = policyResult.rows.length > 0;
      const policy = policyExists ? policyResult.rows[0] : null;

      // Date validation
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Start date can't be in the past
      if (startDate < today) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Start date cannot be in the past" });
      }

      // End date must be after start date
      if (endDate < startDate) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "End date must be after start date" });
      }

      // Calculate days requested (excluding weekends)
      const days_requested = calculateWorkingDays(startDate, endDate);

      // Check notice period if policy exists
      if (policyExists && policy.notice_period_days > 0) {
        const noticeDays = Math.ceil(
          (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (noticeDays < policy.notice_period_days) {
          const earliestPossibleDate = new Date(today);
          earliestPossibleDate.setDate(
            earliestPossibleDate.getDate() + policy.notice_period_days
          );

          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Notice period requirement not met",
            details: {
              required_days: policy.notice_period_days,
              earliest_possible_date: earliestPossibleDate
                .toISOString()
                .split("T")[0],
              message: `This leave type requires ${policy.notice_period_days} days notice`,
            },
          });
        }
      }

      // Check max consecutive days
      const maxConsecutiveDays =
        policyExists && policy.max_consecutive_days
          ? policy.max_consecutive_days
          : leaveType.max_days;

      if (days_requested > maxConsecutiveDays) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Maximum consecutive days exceeded",
          details: {
            max_days: maxConsecutiveDays,
            requested_days: days_requested,
            message: `Maximum ${maxConsecutiveDays} consecutive working days allowed`,
          },
        });
      }

      // Check gender-specific leave eligibility
      if (policyExists && policy.gender_specific) {
        if (!userGender) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Missing Information",
            details:
              "User gender information is required for this type of leave",
          });
        }

        if (userGender !== policy.gender_specific) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Not Eligible",
            details: `This leave type is only available for ${policy.gender_specific} employees`,
          });
        }
      }

      // Check if documents are required
      if (
        leaveType.requires_documentation &&
        (!documents || !documents.length)
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Documentation is required for this leave type",
        });
      }

      // Check if user has enough leave balance
      const balanceResult = await client.query(
        `
      SELECT * FROM leave_balances 
      WHERE user_id = $1 
      AND leave_type_id = $2 
      AND year = EXTRACT(YEAR FROM NOW())
    `,
        [userId, leave_type_id]
      );

      // If no leave balance exists, calculate and initialize leave balances
      if (!balanceResult.rows.length) {
        console.log(`Initializing leave balances for user ${userId}`);

        // Current year
        const currentYear = new Date().getFullYear();

        // First check if the user has any leave balances for the current year
        const anyBalancesResult = await client.query(
          `SELECT COUNT(*) as count
          FROM leave_balances
          WHERE user_id = $1 AND year = $2`,
          [userId, currentYear]
        );

        // If no balances exist at all, initialize them using management settings
        if (parseInt(anyBalancesResult.rows[0].count) === 0) {
          // Get all active leave types for this company
          const leaveTypesResult = await client.query(
            `SELECT 
              lt.id,
              lt.name,
              lt.is_paid,
              lt.max_days as default_days
            FROM leave_types lt
            WHERE lt.is_active = true
            AND (lt.company_id IS NULL OR lt.company_id = $1)
            ORDER BY lt.name`,
            [companyId]
          );

          if (!leaveTypesResult.rows.length) {
            await client.query("ROLLBACK");
            return res
              .status(404)
              .json({ error: "No active leave types found for your company" });
          }

          // Create balance records for each leave type based on management configuration
          for (const leaveType of leaveTypesResult.rows) {
            // The default days is already calculated from the query above
            const defaultDays = leaveType.default_days || 0;

            await client.query(
              `INSERT INTO leave_balances (
                user_id,
                leave_type_id,
                total_days,
                used_days,
                pending_days,
                year,
                created_at,
                updated_at
              ) VALUES ($1, $2, $3, 0, 0, $4, NOW(), NOW())`,
              [userId, leaveType.id, defaultDays, currentYear]
            );
          }

          console.log(
            `Successfully initialized leave balances for user ${userId}`
          );

          // Now fetch the specific leave balance we need for this request
          const updatedBalanceResult = await client.query(
            `SELECT * FROM leave_balances 
            WHERE user_id = $1 
            AND leave_type_id = $2 
            AND year = $3`,
            [userId, leave_type_id, currentYear]
          );

          if (!updatedBalanceResult.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({
              error:
                "The requested leave type is not available for your company",
            });
          }

          // Set the balance for further processing
          balanceResult.rows = updatedBalanceResult.rows;
        } else {
          // User has some balances but not for this specific leave type
          await client.query("ROLLBACK");
          return res.status(400).json({
            error:
              "This leave type is not available for you. Please contact management.",
          });
        }
      }

      const balance = balanceResult.rows[0];
      if (balance.pending_days < days_requested) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Insufficient leave balance" });
      }

      // Check for overlapping leave requests
      const overlapResult = await client.query(
        `
      SELECT * FROM leave_requests 
      WHERE user_id = $1 
      AND status != 'rejected'
      AND (
        (start_date <= $2 AND end_date >= $2)
        OR (start_date <= $3 AND end_date >= $3)
        OR (start_date >= $2 AND end_date <= $3)
      )
    `,
        [userId, start_date, end_date]
      );

      if (overlapResult.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "You have overlapping leave requests for the selected dates",
        });
      }

      // Insert leave request
      const requestResult = await client.query(
        `
      INSERT INTO leave_requests (
        user_id,
        leave_type_id,
        start_date,
        end_date,
        days_requested,
        reason,
        status,
        contact_number,
        requires_documentation
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
      RETURNING id
    `,
        [
          userId,
          leave_type_id,
          start_date,
          end_date,
          days_requested,
          reason,
          contact_number,
          leaveType.requires_documentation,
        ]
      );

      const requestId = requestResult.rows[0].id;

      // Insert documents if any
      if (documents && documents.length > 0) {
        for (const doc of documents) {
          await client.query(
            `
          INSERT INTO leave_documents (
            request_id,
            file_name,
            file_type,
            file_data,
            upload_method
          ) VALUES ($1, $2, $3, $4, $5)
        `,
            [
              requestId,
              doc.file_name,
              doc.file_type,
              doc.file_data,
              doc.upload_method,
            ]
          );
        }
      }

      // Update leave balance
      await client.query(
        `      
      UPDATE leave_balances
      SET 
        pending_days = pending_days + $1,
        updated_at = NOW()
      WHERE user_id = $2 AND leave_type_id = $3 AND year = EXTRACT(YEAR FROM NOW())
    `,
        [days_requested, userId, leave_type_id]
      );

      await client.query("COMMIT");

      res.json({
        message: "Leave request submitted successfully",
        request_id: requestId,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error submitting leave request:", error);
      res.status(500).json({
        error: "Failed to submit leave request",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      client.release();
    }
  }
);

// Helper function to calculate working days between two dates
function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let days = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Skip weekends
      days++;
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// Get document data
router.get(
  "/document/:id",
  [authMiddleware, adminMiddleware],
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { id: groupAdminId } = req.user!;

      // Verify the document belongs to a leave request from an employee under this group admin
      const result = await client.query(
        `
      SELECT ld.file_data, ld.file_type
      FROM leave_documents ld
      JOIN leave_requests lr ON ld.request_id = lr.id
      JOIN users u ON lr.user_id = u.id
      WHERE ld.id = $1 AND u.group_admin_id = $2
    `,
        [id, groupAdminId]
      );

      if (!result.rows.length) {
        return res
          .status(404)
          .json({ error: "Document not found or unauthorized" });
      }

      const { file_data, file_type } = result.rows[0];

      // Send base64 data directly
      res.setHeader("Content-Type", "text/plain");
      res.send(file_data);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({
        error: "Failed to fetch document",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      client.release();
    }
  }
);

// Get pending requests
router.get(
  "/pending-requests",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await client.query(
        `
      SELECT 
        lr.id,
        lr.user_id,
        u.name as user_name,
        u.employee_number,
        d.name as department,
        lr.leave_type_id,
        lt.name as leave_type_name,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason,
        lr.status,
        lr.contact_number,
        lr.requires_documentation,
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
        CASE 
          WHEN le.id IS NOT NULL THEN json_build_object(
            'escalation_id', le.id,
            'escalated_by', le.escalated_by,
            'escalated_by_name', eu.name,
            'reason', le.reason,
            'escalated_at', le.created_at,
            'status', le.status,
            'resolution_notes', le.resolution_notes
          )
          ELSE NULL
        END as escalation_details
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN departments d ON u.department_id = d.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_escalations le ON lr.id = le.request_id
      LEFT JOIN users eu ON le.escalated_by = eu.id
      WHERE (
        lr.user_id = $1 -- Management's own requests
        OR (
          u.role = 'group_admin' 
          AND u.company_id = (SELECT company_id FROM users WHERE id = $1)
        ) -- Direct requests from group admins
        OR (
          lr.status = 'escalated'
          AND le.escalated_to = $1
          AND le.status = 'pending'
        ) -- Escalated requests assigned to this manager
      )
      ORDER BY lr.created_at DESC
    `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ error: "Failed to fetch requests" });
    } finally {
      client.release();
    }
  }
);

// Post request
router.post(
  "/leave-requests/:id/:action",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id, action } = req.params;
      const { rejection_reason, resolution_notes } = req.body;

      await client.query("BEGIN");

      const requestResult = await client.query(
        "SELECT lr.*, le.id as escalation_id, le.status as escalation_status FROM leave_requests lr LEFT JOIN leave_escalations le ON lr.id = le.request_id WHERE lr.id = $1",
        [id]
      );

      if (!requestResult.rows.length) {
        throw new Error("Leave request not found");
      }

      const request = requestResult.rows[0];
      const isEscalated = request.status === "escalated";
      const now = new Date();

      if (isEscalated) {
        if (!resolution_notes) {
          throw new Error(
            "Resolution notes are required for escalated requests"
          );
        }

        await client.query(
          "UPDATE leave_escalations SET status = $1, resolution_notes = $2, resolved_at = $3 WHERE request_id = $4",
          ["resolved", resolution_notes, now, id]
        );
      }

      if (action === "approve" || action === "reject") {
        await client.query(
          "UPDATE leave_requests SET status = $1, rejection_reason = $2, updated_at = $3 WHERE id = $4",
          [
            action === "approve" ? "approved" : "rejected",
            action === "reject" ? rejection_reason : null,
            now,
            id,
          ]
        );
      }

      await client.query("COMMIT");
      res.json({ message: "Leave request processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error processing request:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      client.release();
    }
  }
);

// Initialize my leave balances based on management configurations
router.post(
  "/initialize-my-balances",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get current year
      const currentYear = new Date().getFullYear();

      // Get company ID
      const userResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [userId]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;

      // Fetch all active leave types for the company (both global and company-specific)
      const leaveTypesResult = await client.query(
        `
        SELECT 
          lt.id,
          lt.name,
          lt.is_paid,
          lt.max_days,
          COALESCE(lp.default_days, lt.max_days) as default_days,
          COALESCE(lp.carry_forward_days, 0) as carry_forward_days
        FROM leave_types lt
        LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
        WHERE lt.is_active = true
        AND (lt.company_id IS NULL OR lt.company_id = $1)
        ORDER BY lt.name
        `,
        [companyId]
      );

      if (!leaveTypesResult.rows.length) {
        return res
          .status(404)
          .json({ error: "No active leave types found for your company" });
      }

      await client.query("BEGIN");

      // Get last year's carry-forward balances
      const lastYear = currentYear - 1;
      const lastYearBalances = await client.query(
        `
        SELECT 
          leave_type_id, 
          (total_days - used_days - pending_days) as available_days,
          carry_forward_days
        FROM leave_balances
        WHERE user_id = $1 AND year = $2
        `,
        [userId, lastYear]
      );

      // Create a map to store carry forward days by leave type ID
      const carryForwardMap: { [key: number]: number } = {};
      for (const balance of lastYearBalances.rows) {
        carryForwardMap[balance.leave_type_id] = Math.min(
          parseInt(balance.available_days || '0'),
          parseInt(balance.carry_forward_days || '0')
        );
      }

      // Create balance records for each leave type based on company policies
      for (const leaveType of leaveTypesResult.rows) {
        // Use the policy's default days if available, otherwise use the leave type's max days
        const defaultDays = leaveType.default_days || 0;
        const carryForwardDays = carryForwardMap[leaveType.id] || 0;

        await client.query(
          `
          INSERT INTO leave_balances (
            user_id,
            leave_type_id,
            total_days,
            used_days,
            pending_days,
            carry_forward_days,
            year,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, 0, 0, $4, $5, NOW(), NOW())
          ON CONFLICT (user_id, leave_type_id, year)
          DO UPDATE SET 
            total_days = $3,
            carry_forward_days = $4,
            updated_at = NOW()
          `,
          [userId, leaveType.id, defaultDays, carryForwardDays, currentYear]
        );
      }

      await client.query("COMMIT");
      res.json({
        message: "Leave balances initialized successfully",
        year: currentYear,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error initializing leave balances:", error);
      res.status(500).json({
        error: "Failed to initialize leave balances",
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      client.release();
    }
  }
);

// Get all employees under the group admin
router.get(
  "/employees",
  [authMiddleware, adminMiddleware],
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get all employees under this group admin
      const employeesResult = await client.query(
        `SELECT id, name, employee_number, department 
         FROM users 
         WHERE group_admin_id = $1 AND role = 'employee'
         ORDER BY name`,
        [req.user.id]
      );

      res.json(employeesResult.rows);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({
        error: "Failed to fetch employees",
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      client.release();
    }
  }
);

export default router;
