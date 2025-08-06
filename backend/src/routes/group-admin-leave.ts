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

// Get group admin's own leave balances
router.get(
  "/my-balances",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userId = req.user.id;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      // Get user details including company and gender
      const userResult = await client.query(
        `SELECT company_id, gender FROM users WHERE id = $1`,
        [userId]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const { company_id: companyId, gender } = userResult.rows[0];

      if (!companyId) {
        return res.status(400).json({ error: "User not associated with any company" });
      }

      // Get user's actual leave balances for active leave types with gender-specific filtering
      const result = await client.query(
        `WITH leave_types_with_policies AS (
          SELECT 
            lt.id,
            lt.name,
            lt.description,
            lt.requires_documentation,
            lt.max_days,
            lt.is_paid,
            lt.is_active,
            COALESCE(lp.gender_specific, NULL) as gender_specific,
            COALESCE(lp.default_days, lt.max_days) as default_days,
            COALESCE(lp.carry_forward_days, 0) as carry_forward_days
          FROM leave_types lt
          LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
          WHERE lt.company_id = $1
            AND lt.is_active = true
        )
        SELECT 
          ltp.id as leave_type_id,
          ltp.name as leave_type_name,
          ltp.description,
          ltp.requires_documentation,
          ltp.max_days,
          ltp.is_paid,
          ltp.is_active,
          COALESCE(lb.total_days, ltp.default_days) as total_days,
          COALESCE(lb.used_days, 0) as used_days,
          COALESCE(lb.pending_days, 0) as pending_days,
          COALESCE(lb.carry_forward_days, ltp.carry_forward_days) as carry_forward_days,
          (COALESCE(lb.total_days, ltp.default_days) + COALESCE(lb.carry_forward_days, ltp.carry_forward_days) - COALESCE(lb.used_days, 0) - COALESCE(lb.pending_days, 0)) as available_days,
          $2 as year,
          ltp.gender_specific
        FROM leave_types_with_policies ltp
        LEFT JOIN leave_balances lb ON 
          ltp.id = lb.leave_type_id 
          AND lb.user_id = $3 
          AND lb.year = $2
        WHERE 
          (
            ltp.gender_specific IS NULL 
            OR ltp.gender_specific = $4
            OR $4 IS NULL
          )
        ORDER BY ltp.name ASC`,
        [companyId, year, userId, gender]
      );

      console.log('Group admin leave balances query result:', {
        userId,
        companyId,
        userGender: gender,
        rowCount: result.rows.length,
        leaveTypes: result.rows.map(row => ({
          name: row.leave_type_name,
          genderSpecific: row.gender_specific,
          totalDays: row.total_days,
          usedDays: row.used_days,
          availableDays: row.available_days
        }))
      });

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching group admin leave balances:", error);
      res.status(500).json({ error: "Failed to fetch leave balances" });
    } finally {
      client.release();
    }
  }
);

// Initialize group admin's leave balances
router.post(
  "/initialize-my-balances",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userId = req.user.id;
      const { year = new Date().getFullYear() } = req.body;

      // Get user details
      const userResult = await client.query(
        `SELECT company_id, gender FROM users WHERE id = $1`,
        [userId]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const { company_id: companyId, gender } = userResult.rows[0];

      if (!companyId) {
        return res.status(400).json({ error: "User not associated with any company" });
      }

      // Check if balances already exist for this year
      const existingBalances = await client.query(
        `SELECT COUNT(*) as count FROM leave_balances WHERE user_id = $1 AND year = $2`,
        [userId, year]
      );

      if (existingBalances.rows[0].count > 0) {
        // Balances already exist, return them
        const balances = await client.query(
          `SELECT 
            lb.*,
            lt.name as leave_type_name,
            lt.is_paid,
            lt.max_days,
            lt.requires_documentation
          FROM leave_balances lb
          JOIN leave_types lt ON lb.leave_type_id = lt.id
          WHERE lb.user_id = $1 AND lb.year = $2
          ORDER BY lt.name`,
          [userId, year]
        );

        return res.json({
          status: "exists",
          balances: balances.rows
        });
      }

      // Get active leave types for the company with gender-specific filtering
      const leaveTypesResult = await client.query(
        `WITH leave_types_with_policies AS (
          SELECT 
            lt.id,
            lt.name,
            lt.description,
            lt.requires_documentation,
            lt.max_days,
            lt.is_paid,
            lt.is_active,
            COALESCE(lp.gender_specific, NULL) as gender_specific,
            COALESCE(lp.default_days, lt.max_days) as default_days,
            COALESCE(lp.carry_forward_days, 0) as carry_forward_days
          FROM leave_types lt
          LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
          WHERE lt.company_id = $1
            AND lt.is_active = true
        )
        SELECT * FROM leave_types_with_policies
        WHERE 
          (
            gender_specific IS NULL 
            OR gender_specific = $2
            OR $2 IS NULL
          )
        ORDER BY name`,
        [companyId, gender]
      );

      if (leaveTypesResult.rows.length === 0) {
        return res.status(400).json({ error: "No active leave types found for your company" });
      }

      // Initialize balances for each leave type
      const balancesToInsert = leaveTypesResult.rows.map(lt => ({
        user_id: userId,
        leave_type_id: lt.id,
        total_days: lt.default_days,
        used_days: 0,
        pending_days: 0,
        carry_forward_days: lt.carry_forward_days,
        year: year
      }));

      // Insert all balances
      for (const balance of balancesToInsert) {
        await client.query(
          `INSERT INTO leave_balances (
            user_id, leave_type_id, total_days, used_days, 
            pending_days, carry_forward_days, year, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            balance.user_id,
            balance.leave_type_id,
            balance.total_days,
            balance.used_days,
            balance.pending_days,
            balance.carry_forward_days,
            balance.year
          ]
        );
      }

      // Return the created balances
      const createdBalances = await client.query(
        `SELECT 
          lb.*,
          lt.name as leave_type_name,
          lt.is_paid,
          lt.max_days,
          lt.requires_documentation
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.user_id = $1 AND lb.year = $2
        ORDER BY lt.name`,
        [userId, year]
      );

      res.json({
        status: "created",
        balances: createdBalances.rows
      });

    } catch (error) {
      console.error("Error initializing group admin leave balances:", error);
      res.status(500).json({ error: "Failed to initialize leave balances" });
    } finally {
      client.release();
    }
  }
);

// Get group admin's own leave requests
router.get(
  "/my-requests",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userId = req.user.id;

      const result = await client.query(`
        SELECT 
          lr.*,
          lt.name as leave_type_name,
          lt.requires_documentation,
          lt.is_paid,
          json_agg(
            CASE WHEN ld.id IS NOT NULL THEN
              json_build_object(
                'id', ld.id,
                'file_name', ld.file_name,
                'file_type', ld.file_type,
                'file_data', ld.file_data,
                'upload_method', ld.upload_method
              )
            ELSE NULL END
          ) FILTER (WHERE ld.id IS NOT NULL) as documents
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN leave_documents ld ON lr.id = ld.request_id
        WHERE lr.user_id = $1
        GROUP BY lr.id, lt.name, lt.requires_documentation, lt.is_paid
        ORDER BY lr.created_at DESC
      `, [userId]);

      // Clean up the documents array (remove null values)
      const requests = result.rows.map(row => ({
        ...row,
        documents: row.documents ? row.documents.filter((doc: any) => doc !== null) : []
      }));

      res.json(requests);
    } catch (error) {
      console.error("Error fetching group admin leave requests:", error);
      res.status(500).json({ error: "Failed to fetch leave requests" });
    } finally {
      client.release();
    }
  }
);

// Get list of employees under the group admin
router.get(
  "/employees",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const groupAdminId = req.user.id;

      const result = await client.query(`
        SELECT 
          id,
          name,
          employee_number,
          email,
          department,
          designation,
          role,
          gender,
          status
        FROM users 
        WHERE group_admin_id = $1 
          AND role = 'employee'
          AND status = 'active'
        ORDER BY name
      `, [groupAdminId]);

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ error: "Failed to fetch employees" });
    } finally {
      client.release();
    }
  }
);

// Submit leave request for group admin
router.post(
  "/request",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userId = req.user.id;
      const {
        leave_type_id,
        start_date,
        end_date,
        reason,
        contact_number,
        documents = []
      } = req.body;

      // Validate required fields
      if (!leave_type_id || !start_date || !end_date || !reason || !contact_number) {
        return res.status(400).json({ 
          error: "Missing required fields",
          details: "All fields are required: leave_type_id, start_date, end_date, reason, contact_number"
        });
      }

      // Get user details and company
      const userResult = await client.query(
        `SELECT company_id, gender FROM users WHERE id = $1`,
        [userId]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const { company_id: companyId, gender } = userResult.rows[0];

      if (!companyId) {
        return res.status(400).json({ error: "User not associated with any company" });
      }

      // Validate leave type exists and is active for the company
      const leaveTypeResult = await client.query(
        `SELECT 
          lt.*,
          lp.notice_period_days,
          lp.max_consecutive_days,
          lp.min_service_days,
          lp.requires_approval,
          COALESCE(lp.gender_specific, NULL) as gender_specific
        FROM leave_types lt
        LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
        WHERE lt.id = $1 
          AND lt.company_id = $2 
          AND lt.is_active = true`,
        [leave_type_id, companyId]
      );

      if (!leaveTypeResult.rows.length) {
        return res.status(400).json({ 
          error: "Leave type not found or not available",
          details: "The selected leave type is not available for your company"
        });
      }

      const leaveType = leaveTypeResult.rows[0];

      // Check gender-specific restrictions
      if (leaveType.gender_specific && leaveType.gender_specific !== gender) {
        return res.status(400).json({
          error: "Not eligible for this leave type",
          details: `This leave type is only available for ${leaveType.gender_specific} users`
        });
      }

      // Validate dates
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate < today) {
        return res.status(400).json({
          error: "Invalid start date",
          details: "Start date cannot be in the past"
        });
      }

      if (endDate < startDate) {
        return res.status(400).json({
          error: "Invalid date range",
          details: "End date cannot be before start date"
        });
      }

      // Calculate working days
      const workingDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Notice period validation
      if (leaveType.notice_period_days) {
        const noticeDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (noticeDays < leaveType.notice_period_days) {
          const earliestPossibleDate = new Date(today);
          earliestPossibleDate.setDate(earliestPossibleDate.getDate() + leaveType.notice_period_days);
          
          return res.status(400).json({
            error: "Notice period requirement not met",
            details: {
              message: `This leave type requires ${leaveType.notice_period_days} days advance notice`,
              required_days: leaveType.notice_period_days,
              earliest_possible_date: earliestPossibleDate.toISOString().split('T')[0]
            }
          });
        }
      }

      // Max consecutive days validation
      if (leaveType.max_consecutive_days && workingDays > leaveType.max_consecutive_days) {
        return res.status(400).json({
          error: "Maximum consecutive days exceeded",
          details: {
            message: `This leave type allows a maximum of ${leaveType.max_consecutive_days} consecutive days`,
            max_days: leaveType.max_consecutive_days,
            requested_days: workingDays
          }
        });
      }

      // Check for overlapping requests
      const overlappingResult = await client.query(
        `SELECT id FROM leave_requests 
         WHERE user_id = $1 
           AND status IN ('pending', 'approved')
           AND (
             (start_date <= $2 AND end_date >= $3) OR
             (start_date >= $2 AND start_date <= $3) OR
             (end_date >= $2 AND end_date <= $3)
           )`,
        [userId, start_date, end_date]
      );

      if (overlappingResult.rows.length > 0) {
        return res.status(400).json({
          error: "Overlapping leave requests",
          details: "You have an existing leave request that overlaps with these dates"
        });
      }

      // Check leave balance
      const balanceResult = await client.query(
        `SELECT 
          total_days,
          used_days,
          pending_days,
          carry_forward_days,
          (total_days + COALESCE(carry_forward_days, 0) - used_days - pending_days) as available_days
        FROM leave_balances 
        WHERE user_id = $1 
          AND leave_type_id = $2 
          AND year = EXTRACT(YEAR FROM $3::date)`,
        [userId, leave_type_id, start_date]
      );

      if (!balanceResult.rows.length) {
        return res.status(400).json({
          error: "No leave balance found",
          details: "You need to initialize your leave balances before submitting a request"
        });
      }

      const balance = balanceResult.rows[0];
      if (balance.available_days < workingDays) {
        return res.status(400).json({
          error: "Insufficient leave balance",
          details: `You have ${balance.available_days} days available but requesting ${workingDays} days`
        });
      }

      // Validate documentation requirement
      if (leaveType.requires_documentation && (!documents || documents.length === 0)) {
        return res.status(400).json({
          error: "Documentation is required",
          details: "This leave type requires supporting documentation"
        });
      }

      await client.query('BEGIN');

      // Insert leave request
      const requestResult = await client.query(
        `INSERT INTO leave_requests (
          user_id,
          leave_type_id,
          start_date,
          end_date,
          reason,
          status,
          contact_number,
          requires_documentation,
          days_requested,
          has_documentation,
          group_admin_id,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING id`,
        [
          userId,
          leave_type_id,
          start_date,
          end_date,
          reason,
          'pending',
          contact_number,
          leaveType.requires_documentation,
          workingDays,
          documents.length > 0,
          userId, // group_admin_id for self-requests
        ]
      );

      const requestId = requestResult.rows[0].id;

      // Insert documents if provided
      if (documents && documents.length > 0) {
        for (const doc of documents) {
          await client.query(
            `INSERT INTO leave_documents (
              request_id,
              file_name,
              file_type,
              file_data,
              upload_method,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
              requestId,
              doc.file_name,
              doc.file_type,
              doc.file_data,
              doc.upload_method
            ]
          );
        }
      }

      // Update leave balance (add to pending days)
      await client.query(
        `UPDATE leave_balances 
         SET 
           pending_days = pending_days + $1,
           updated_at = NOW()
         WHERE user_id = $2 
           AND leave_type_id = $3 
           AND year = EXTRACT(YEAR FROM $4::date)`,
        [workingDays, userId, leave_type_id, start_date]
      );

      await client.query('COMMIT');

      // Return success response
      res.json({
        success: true,
        message: "Leave request submitted successfully",
        request_id: requestId,
        details: {
          leave_type: leaveType.name,
          start_date,
          end_date,
          days_requested: workingDays,
          status: 'pending'
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error submitting leave request:", error);
      res.status(500).json({
        error: "Failed to submit leave request",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      client.release();
    }
  }
);

export default router;
