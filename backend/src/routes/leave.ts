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
router.get(
  "/balance",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const year =
        parseInt(req.query.year as string) || new Date().getFullYear();

      // Get the user's company ID
      const userResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;

      // First, fetch all active leave types for this company (both global and company-specific)
      const leaveTypesResult = await client.query(
        `
      SELECT 
        lt.id,
        lt.name,
        lt.is_paid,
        lt.max_days,
        COALESCE(lp.default_days, lt.max_days) as default_days
      FROM leave_types lt
      LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
      WHERE lt.is_active = true
      AND (lt.company_id IS NULL OR lt.company_id = $1)
      ORDER BY lt.name
    `,
        [companyId]
      );

      if (!leaveTypesResult.rows.length) {
        return res.status(404).json({
          error: "No active leave types found for your company",
          details: "Please contact management to configure leave types",
        });
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

      // Get user's company ID
      const userResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;

      // Fetch leave types and policies
      const result = await client.query(
        `
      SELECT 
        lt.id,
        lt.name,
        lt.description,
        lt.requires_documentation,
        lt.max_days,
        lt.is_paid,
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

      const userId = req.user;
      const {
        leave_type_id,
        start_date,
        end_date,
        reason,
        contact_number,
        documents,
      } = req.body;

      await client.query("BEGIN");

      // Get user's company ID and gender
      const userResult = await client.query(
        `SELECT company_id, gender FROM users WHERE id = $1`,
        [userId.id]
      );

      if (!userResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      const companyId = userResult.rows[0].company_id;
      const userGender = userResult.rows[0].gender;

      // Get leave type and policy details
      const leaveTypeResult = await client.query(
        `
        SELECT 
          lt.*,
          lp.default_days as policy_default_days,
          lp.notice_period_days as policy_notice_period,
          lp.max_consecutive_days as policy_max_consecutive,
          lp.gender_specific,
          COALESCE(lb.total_days, 0) as total_days,
          COALESCE(lb.used_days, 0) as used_days,
          COALESCE(lb.pending_days, 0) as pending_days,
          COALESCE(lb.carry_forward_days, 0) as carry_forward_days
        FROM leave_types lt
        LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
        LEFT JOIN leave_balances lb ON lt.id = lb.leave_type_id 
          AND lb.user_id = $1 
          AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
        WHERE lt.id = $2
        AND lt.is_active = true
        AND (lt.company_id IS NULL OR lt.company_id = $3)
      `,
        [userId.id, leave_type_id, companyId]
      );

      if (!leaveTypeResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Invalid leave type",
          details: "The requested leave type is not available for your company",
        });
      }

      const leaveType = leaveTypeResult.rows[0];

      // Check gender-specific leave eligibility
      if (
        leaveType.gender_specific &&
        leaveType.gender_specific !== userGender
      ) {
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

      // Calculate available days
      const total_available = leaveType.total_days + leaveType.carry_forward_days;
      const used_and_pending = leaveType.used_days + leaveType.pending_days;
      const available_days = total_available - used_and_pending;

      // Validate maximum consecutive days
      const max_consecutive = leaveType.policy_max_consecutive || leaveType.max_days;
      if (days_requested > max_consecutive) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Maximum consecutive days exceeded",
          details: {
            max_allowed: max_consecutive,
            requested_days: days_requested,
          },
        });
      }

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

      // Check notice period
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const noticeDays = Math.ceil(
        (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (noticeDays < (leaveType.policy_notice_period || 0)) {
        await client.query("ROLLBACK");
        const earliestPossibleDate = new Date(today);
        earliestPossibleDate.setDate(
          earliestPossibleDate.getDate() + (leaveType.policy_notice_period || 0)
        );

        return res.status(400).json({
          error: "Notice period requirement not met",
          details: {
            required_days: leaveType.policy_notice_period,
            earliest_possible_date: earliestPossibleDate
              .toISOString()
              .split("T")[0],
            message: `This leave type requires ${leaveType.policy_notice_period} days notice`,
          },
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
          contact_number,
          status,
          requires_documentation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
        RETURNING id
      `,
        [
          userId.id,
          leave_type_id,
          start_date,
          end_date,
          days_requested,
          reason,
          contact_number,
          leaveType.requires_documentation,
        ]
      );

      // Create or update leave balance
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
        ) 
        VALUES ($1, $2, $3, $4, $5, EXTRACT(YEAR FROM CURRENT_DATE), NOW(), NOW())
        ON CONFLICT (user_id, leave_type_id, year) 
        DO UPDATE SET 
          pending_days = leave_balances.pending_days + $6,
          updated_at = NOW()
        `,
        [
          userId.id,
          leave_type_id,
          leaveType.policy_default_days || leaveType.max_days,
          leaveType.used_days,
          leaveType.pending_days,
          days_requested
        ]
      );

      // Handle document uploads if any
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
              requestResult.rows[0].id,
              doc.file_name,
              doc.file_type,
              doc.file_data,
              doc.upload_method,
            ]
          );
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

// Cancel leave request
router.post(
  "/cancel/:id",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      // Verify ownership and status
      const verifyResult = await client.query(
        "SELECT lr.*, lb.id as balance_id FROM leave_requests lr JOIN leave_balances lb ON lr.user_id = lb.user_id AND lr.leave_type_id = lb.leave_type_id WHERE lr.id = $1 AND lr.user_id = $2 AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)",
        [id, req.user?.id]
      );

      if (!verifyResult.rows.length) {
        return res.status(404).json({ error: "Leave request not found" });
      }

      if (verifyResult.rows[0].status !== "pending") {
        return res
          .status(400)
          .json({ error: "Can only cancel pending requests" });
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