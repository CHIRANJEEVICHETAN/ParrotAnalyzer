import express, { Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';

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

    // Get company_id for validation
    const userResult = await client.query(
      `SELECT company_id FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const companyId = userResult.rows[0].company_id;

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
        ) as documents,
        json_build_object(
          'total_days', lb.total_days,
          'used_days', lb.used_days,
          'pending_days', lb.pending_days,
          'carry_forward_days', lb.carry_forward_days
        ) as balance_info
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_balances lb ON lr.user_id = lb.user_id 
        AND lr.leave_type_id = lb.leave_type_id 
        AND EXTRACT(YEAR FROM lr.start_date) = lb.year
      WHERE lr.user_id = $1 
        AND lt.company_id = $2
      ORDER BY lr.created_at DESC
    `, [req.user.id, companyId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  } finally {
    client.release();
  }
});

// Get employee's leave balance
router.get(
  "/balance",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      // Get user's company ID and role
      const userResult = await client.query(
        `SELECT company_id, role FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;
      const userRole = userResult.rows[0].role;

      // Get all leave types and balances for this company
      const result = await client.query(`
        SELECT 
          lt.id,
          lt.name,
          lt.is_paid,
          lt.requires_documentation,
          lt.max_days,
          cdb.default_days as role_default_days,
          cdb.carry_forward_days as role_carry_forward_days,
          COALESCE(lb.total_days, cdb.default_days, 0) as total_days,
          COALESCE(lb.used_days, 0) as used_days,
          COALESCE(lb.pending_days, 0) as pending_days,
          COALESCE(lb.carry_forward_days, 0) as carry_forward_days,
          (COALESCE(lb.total_days, cdb.default_days, 0) + 
           COALESCE(lb.carry_forward_days, 0) - 
           COALESCE(lb.used_days, 0) - 
           COALESCE(lb.pending_days, 0)) as available_days
        FROM leave_types lt
        LEFT JOIN company_default_leave_balances cdb ON lt.id = cdb.leave_type_id 
          AND cdb.role = $3
        LEFT JOIN leave_balances lb ON lt.id = lb.leave_type_id 
          AND lb.user_id = $1 
          AND lb.year = $2
        WHERE lt.company_id = $4
          AND lt.is_active = true
        ORDER BY lt.name
      `, [req.user.id, year, userRole, companyId]);

      if (!result.rows.length) {
        return res.status(404).json({
          error: "No active leave types found for your company",
          details: "Please contact management to configure leave types",
        });
      }

      res.json(result.rows);
    } catch (error) {
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

// Get leave types with policies
router.get(
  "/types",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get user's company ID and role
      const userResult = await client.query(
        `SELECT company_id, role FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;
      const userRole = userResult.rows[0].role;

      // Fetch leave types and policies with role-specific defaults
      const result = await client.query(`
        SELECT 
          lt.id,
          lt.name,
          lt.description,
          lt.requires_documentation,
          lt.max_days,
          lt.is_paid,
          cdb.default_days,
          cdb.carry_forward_days,
          lp.min_service_days,
          lp.notice_period_days,
          lp.max_consecutive_days,
          lp.gender_specific
        FROM leave_types lt
        LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
        LEFT JOIN company_default_leave_balances cdb ON lt.id = cdb.leave_type_id 
          AND cdb.role = $2
        WHERE lt.company_id = $1
          AND lt.is_active = true
        ORDER BY lt.name
      `, [companyId, userRole]);

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching leave types:", error);
      res.status(500).json({
        error: "Failed to fetch leave types",
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      client.release();
    }
  }
);

// Submit leave request
router.post(
  "/request",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const {
        leave_type_id,
        start_date,
        end_date,
        reason,
        contact_number,
        documents,
      } = req.body;

      // Validate required fields
      if (!leave_type_id || !start_date || !end_date || !reason || !contact_number) {
        return res.status(400).json({ error: "All fields are required" });
      }

      await client.query("BEGIN");

      // Get user's company ID, role, and gender
      const userResult = await client.query(
        `SELECT company_id, role, gender FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!userResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;
      const userRole = userResult.rows[0].role;
      const userGender = userResult.rows[0].gender;

      // Get leave type, policy, and role-based defaults
      const leaveTypeResult = await client.query(`
        SELECT 
          lt.*,
          lp.min_service_days,
          lp.notice_period_days,
          lp.max_consecutive_days,
          lp.gender_specific,
          cdb.default_days as role_default_days,
          cdb.carry_forward_days as role_carry_forward_days,
          COALESCE(lb.total_days, cdb.default_days, 0) as total_days,
          COALESCE(lb.used_days, 0) as used_days,
          COALESCE(lb.pending_days, 0) as pending_days,
          COALESCE(lb.carry_forward_days, 0) as carry_forward_days
        FROM leave_types lt
        LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
        LEFT JOIN company_default_leave_balances cdb ON lt.id = cdb.leave_type_id 
          AND cdb.role = $3
        LEFT JOIN leave_balances lb ON lt.id = lb.leave_type_id 
          AND lb.user_id = $1 
          AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
        WHERE lt.id = $2
          AND lt.company_id = $4
          AND lt.is_active = true
      `, [req.user.id, leave_type_id, userRole, companyId]);

      if (!leaveTypeResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Invalid leave type",
          details: "The requested leave type is not available for your company",
        });
      }

      const leaveType = leaveTypeResult.rows[0];

      // Check gender-specific leave eligibility
      if (leaveType.gender_specific && leaveType.gender_specific !== userGender) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Not eligible for this leave type",
          details: `This leave type is only available for ${leaveType.gender_specific} employees`,
        });
      }

      // Calculate days requested
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const days_requested = calculateWorkingDays(startDate, endDate);

      // Validate dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate < today) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Start date cannot be in the past" });
      }

      if (endDate < startDate) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "End date must be after start date" });
      }

      // Check notice period
      if (leaveType.notice_period_days > 0) {
        const noticeDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (noticeDays < leaveType.notice_period_days) {
          await client.query("ROLLBACK");
          const earliestPossibleDate = new Date(today);
          earliestPossibleDate.setDate(earliestPossibleDate.getDate() + leaveType.notice_period_days);
          return res.status(400).json({
            error: "Notice period requirement not met",
            details: {
              required_days: leaveType.notice_period_days,
              earliest_possible_date: earliestPossibleDate.toISOString().split("T")[0],
              message: `This leave type requires ${leaveType.notice_period_days} days notice`,
            },
          });
        }
      }

      // Check maximum consecutive days
      if (days_requested > leaveType.max_consecutive_days) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Maximum consecutive days exceeded",
          details: {
            max_allowed: leaveType.max_consecutive_days,
            requested_days: days_requested,
          },
        });
      }

      // Calculate available days
      const total_available = leaveType.total_days + leaveType.carry_forward_days;
      const used_and_pending = leaveType.used_days + leaveType.pending_days;
      const available_days = total_available - used_and_pending;

      // Validate available days
      if (available_days < days_requested) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Insufficient leave balance",
          details: {
            available_days,
            requested_days: days_requested,
            total_balance: total_available,
            used_days: leaveType.used_days,
            pending_days: leaveType.pending_days,
          },
        });
      }

      // Check for overlapping requests
      const overlapResult = await client.query(`
        SELECT id FROM leave_requests 
        WHERE user_id = $1 
          AND status NOT IN ('rejected', 'cancelled')
          AND (
            (start_date <= $2 AND end_date >= $2)
            OR (start_date <= $3 AND end_date >= $3)
            OR (start_date >= $2 AND end_date <= $3)
          )
      `, [req.user.id, start_date, end_date]);

      if (overlapResult.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Overlapping leave request",
          details: "You already have a leave request for these dates",
        });
      }

      // Get appropriate workflow for this request
      const workflowResult = await client.query(`
        SELECT aw.*, al.id as first_level_id
        FROM approval_workflows aw
        JOIN workflow_levels wl ON aw.id = wl.workflow_id
        JOIN approval_levels al ON wl.level_id = al.id
        WHERE aw.leave_type_id = $1
        AND aw.company_id = $2
        AND aw.min_days <= $3
        AND (aw.max_days IS NULL OR aw.max_days >= $3)
        AND al.level_order = 1
        AND aw.is_active = true
        AND al.is_active = true
      `, [leave_type_id, companyId, days_requested]);

      if (!workflowResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'No approval workflow found for this request',
          details: 'Please contact your administrator'
        });
      }

      const workflow = workflowResult.rows[0];

      // Create or update leave balance
      await client.query(`
        INSERT INTO leave_balances (
          user_id, leave_type_id, total_days, used_days, pending_days,
          carry_forward_days, year, created_at, updated_at
        ) 
        VALUES (
          $1, $2, $3, $4, $5, $6, 
          EXTRACT(YEAR FROM CURRENT_DATE), NOW(), NOW()
        )
        ON CONFLICT (user_id, leave_type_id, year) 
        DO UPDATE SET 
          pending_days = leave_balances.pending_days + $7,
          updated_at = NOW()
      `, [
        req.user.id,
        leave_type_id,
        leaveType.role_default_days,
        leaveType.used_days,
        leaveType.pending_days,
        leaveType.role_carry_forward_days,
        days_requested
      ]);

      // Insert leave request with workflow
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
          requires_documentation,
          workflow_id,
          current_level_id,
          approval_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, 'pending')
        RETURNING id
      `, [
        req.user.id,
        leave_type_id,
        start_date,
        end_date,
        days_requested,
        reason,
        contact_number,
        leaveType.requires_documentation,
        workflow.id,
        workflow.first_level_id
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
            doc.upload_method,
          ]);
        }
      }

      await client.query("COMMIT");
      res.json({
        message: "Leave request submitted successfully",
        details: {
          request_id: requestResult.rows[0].id,
          days_requested,
          remaining_balance: available_days - days_requested,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error submitting leave request:", error);
      res.status(500).json({
        error: "Failed to submit leave request",
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      client.release();
    }
  }
);

// Cancel leave request
router.post(
  "/cancel/:id",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      // Get user's company ID
      const userResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user?.id]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;

      // Verify ownership, status, and company
      const verifyResult = await client.query(`
        SELECT lr.*, lb.id as balance_id 
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        JOIN leave_balances lb ON lr.user_id = lb.user_id 
          AND lr.leave_type_id = lb.leave_type_id 
          AND EXTRACT(YEAR FROM lr.start_date) = lb.year
        WHERE lr.id = $1 
          AND lr.user_id = $2 
          AND lt.company_id = $3
      `, [id, req.user?.id, companyId]);

      if (!verifyResult.rows.length) {
        return res.status(404).json({ error: "Leave request not found" });
      }

      if (verifyResult.rows[0].status !== "pending") {
        return res.status(400).json({ error: "Can only cancel pending requests" });
      }

      await client.query("BEGIN");

      // Update request status
      await client.query(
        "UPDATE leave_requests SET status = $1 WHERE id = $2",
        ["cancelled", id]
      );

      // Update balance - remove pending days
      await client.query(
        "UPDATE leave_balances SET pending_days = pending_days - $1 WHERE id = $2",
        [verifyResult.rows[0].days_requested, verifyResult.rows[0].balance_id]
      );

      await client.query("COMMIT");
      res.json({ message: "Leave request cancelled successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error cancelling leave request:", error);
      res.status(500).json({ error: "Failed to cancel leave request" });
    } finally {
      client.release();
    }
  }
);

// Get team calendar data for leave requests
router.get(
  "/team-calendar",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { start_date, end_date } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({ 
          error: "start_date and end_date are required" 
        });
      }

      // Get user's company_id
      const userResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;

      // Get all leave requests for the company within the date range
      const result = await client.query(
        `SELECT 
          lr.id,
          lr.user_id,
          u.name as employee_name,
          lt.name as leave_type,
          lr.start_date,
          lr.end_date,
          lr.status,
          lt.is_paid
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE u.company_id = $1 
          AND lr.start_date >= $2 
          AND lr.end_date <= $3
          AND lr.status IN ('pending', 'approved')
        ORDER BY lr.start_date ASC`,
        [companyId, start_date, end_date]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching team calendar:", error);
      res.status(500).json({ error: "Failed to fetch team calendar data" });
    } finally {
      client.release();
    }
  }
);

// Get company holidays
router.get(
  "/holidays",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { start_date, end_date } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({ 
          error: "start_date and end_date are required" 
        });
      }

      // Get user's company_id
      const userResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;

      // Get holidays for the company within the date range
      const result = await client.query(
        `SELECT 
          date,
          name,
          is_full_day
        FROM company_holidays
        WHERE company_id = $1 
          AND date >= $2 
          AND date <= $3
        ORDER BY date ASC`,
        [companyId, start_date, end_date]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      res.status(500).json({ error: "Failed to fetch holidays data" });
    } finally {
      client.release();
    }
  }
);

// Helper function to calculate working days between two dates (excluding weekends)
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