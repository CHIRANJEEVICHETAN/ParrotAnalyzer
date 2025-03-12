import express, { Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { pool } from '../config/database';
import { CustomRequest } from '../types';
import multer from 'multer';
import { verifyToken } from "../middleware/auth";

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Add this helper function at the top
const convertToLocalTime = (isoString: string) => {
  return isoString.replace(/Z$/, ""); // Remove Z suffix to treat as local time
};

// Get management profile data
router.get(
  "/profile",
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
        u.id,
        u.name,
        u.email,
        u.phone,
        u.profile_image,
        c.name as company_name,
        c.id as company_id,
        u.role
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1 AND u.role = 'management'
    `,
        [req.user.id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const profile = result.rows[0];

      // Convert profile_image to base64 if it exists
      if (profile.profile_image) {
        profile.profile_image = profile.profile_image.toString("base64");
      }

      res.json(profile);
    } catch (error) {
      console.error("Error fetching management profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    } finally {
      client.release();
    }
  }
);

// Update management profile
router.put(
  "/profile",
  authMiddleware,
  upload.single("profileImage"),
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { name, phone } = req.body;
      const profileImage = req.file?.buffer;

      await client.query("BEGIN");

      // Start building the query
      let query = `
      UPDATE users 
      SET 
        name = $1,
        phone = $2,
        updated_at = CURRENT_TIMESTAMP
    `;

      let values = [name, phone];

      // Add profile image to update if provided
      if (profileImage) {
        query += `, profile_image = $${values.length + 1}`;
        values.push(profileImage);
      }

      query += ` WHERE id = $${
        values.length + 1
      } AND role = 'management' RETURNING id`;
      values.push(req.user.id);

      const updateResult = await client.query(query, values);

      if (!updateResult.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Profile not found" });
      }

      // Get updated profile with company information
      const profileResult = await client.query(
        `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.profile_image,
        c.name as company_name,
        c.id as company_id
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1
    `,
        [updateResult.rows[0].id]
      );

      await client.query("COMMIT");

      const updatedProfile = profileResult.rows[0];

      // Convert profile_image to base64 if it exists
      if (updatedProfile.profile_image) {
        updatedProfile.profile_image =
          updatedProfile.profile_image.toString("base64");
      }

      res.json(updatedProfile);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error updating management profile:", error);
      res.status(500).json({
        error: "Failed to update profile",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      client.release();
    }
  }
);

// Add this new endpoint
router.get(
  "/dashboard-stats",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id || req.user.role !== "management") {
        console.log("Access denied:", {
          userId: req.user?.id,
          role: req.user?.role,
        });
        return res.status(403).json({ error: "Access denied" });
      }

      const companyId = req.user.company_id;
      console.log("Fetching stats for company:", companyId);

      // Declare variables outside try blocks
      let teamsResult;
      let userLimitResult;

      // Get total teams (group admins)
      try {
        teamsResult = await client.query(
          `SELECT COUNT(*) as total_teams 
         FROM users 
         WHERE company_id = $1 AND role = 'group-admin'`,
          [companyId]
        );
        console.log("Teams query successful:", teamsResult.rows[0]);
      } catch (error) {
        console.error("Teams query failed:", error);
        throw error;
      }

      // Get user limit
      try {
        userLimitResult = await client.query(
          `SELECT user_limit 
         FROM companies 
         WHERE id = $1`,
          [companyId]
        );
        console.log("User limit query successful:", userLimitResult.rows[0]);
      } catch (error) {
        console.error("User limit query failed:", error);
        throw error;
      }

      // Check if employee_tasks table exists
      try {
        const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'employee_tasks'
        );
      `);
        console.log("employee_tasks table exists:", tableCheck.rows[0].exists);
      } catch (error) {
        console.error("Table check failed:", error);
      }

      // Update the activities query
      const activitiesResult = await client.query(
        `
      (
        -- Pending Expense Approvals
        SELECT 
          'expense' as type,
          CASE 
            WHEN e.status = 'pending' THEN 'Pending Approval'
            WHEN e.status = 'approved' THEN 'Approved'
            WHEN e.status = 'rejected' THEN 'Rejected'
          END as title,
          jsonb_build_object(
            'employee_name', e.employee_name,
            'amount', e.total_amount,
            'group_admin', ga.name,
            'department', e.department,
            'date', TO_CHAR(e.date, 'DD-MM-YYYY'),
            'status', e.status
          ) as description,
          e.created_at as time
        FROM expenses e
        JOIN users ga ON e.group_admin_id = ga.id
        WHERE ga.company_id = $1 
        AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY e.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        -- New Employee Activities
        SELECT 
          'employee' as type,
          'New Employee Added' as title,
          jsonb_build_object(
            'name', u.name,
            'department', u.department,
            'group_admin', ga.name
          ) as description,
          u.created_at as time
        FROM users u
        JOIN users ga ON u.group_admin_id = ga.id
        WHERE u.company_id = $1 
        AND u.role = 'employee'
        AND u.created_at >= CURRENT_DATE - INTERVAL '30 days'
        LIMIT 5
      )
      UNION ALL
      (
        -- Group Admin Activities
        SELECT 
          'team' as type,
          'Team Activity' as title,
          jsonb_build_object(
            'name', u.name,
            'action', 'Added as Group Admin'
          ) as description,
          u.created_at as time
        FROM users u
        WHERE u.company_id = $1 
        AND u.role = 'group-admin'
        AND u.created_at >= CURRENT_DATE - INTERVAL '30 days'
        LIMIT 5
      )
      ORDER BY time DESC
      LIMIT 10
    `,
        [companyId]
      );

      // Get performance metrics (based on tasks)
      const performanceMetrics = await client.query(
        `
      WITH team_stats AS (
        SELECT 
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
        FROM employee_tasks t
        JOIN users u ON t.assigned_to = u.id
        WHERE u.company_id = $1
        AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT 
        ROUND(COALESCE(
          (completed_tasks::float / NULLIF(total_tasks, 0) * 100), 
          0
        ))::integer as team_performance
      FROM team_stats
    `,
        [companyId]
      );

      // Get attendance metrics
      const attendanceMetrics = await client.query(
        `
      WITH monthly_stats AS (
        SELECT 
          u.id as user_id,
          COUNT(DISTINCT DATE(es.start_time)) as days_present
        FROM users u
        LEFT JOIN employee_shifts es ON u.id = es.user_id
        WHERE u.company_id = $1 
        AND u.role = 'employee'
        AND es.start_time >= CURRENT_DATE - INTERVAL '30 days'
        AND es.end_time IS NOT NULL  -- Completed shifts
        AND es.status = 'completed'
        GROUP BY u.id
      ),
      employee_count AS (
        SELECT COUNT(*) as total_employees
        FROM users
        WHERE company_id = $1 
        AND role = 'employee'
      ),
      attendance_summary AS (
        SELECT 
          COALESCE(AVG(
            CASE 
              WHEN days_present > 0 THEN (days_present::float / 30) * 100
              ELSE 0 
            END
          ), 0) as attendance_rate
        FROM monthly_stats
      )
      SELECT 
        ROUND(attendance_rate)::integer as attendance_rate
      FROM attendance_summary
    `,
        [companyId]
      );

      // Get travel efficiency metrics
      const travelMetrics = await client.query(
        `
      WITH current_period AS (
        SELECT 
          COALESCE(AVG(
            CASE 
              WHEN total_kilometers > 0 AND total_amount > 0 
              THEN total_amount / total_kilometers
              ELSE NULL 
            END
          ), 0) as current_avg_cost
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE u.company_id = $1
        AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ),
      previous_period AS (
        SELECT 
          COALESCE(AVG(
            CASE 
              WHEN total_kilometers > 0 AND total_amount > 0 
              THEN total_amount / total_kilometers
              ELSE NULL 
            END
          ), 0) as previous_avg_cost
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE u.company_id = $1
        AND e.created_at >= CURRENT_DATE - INTERVAL '60 days'
        AND e.created_at < CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT 
        ROUND(current_avg_cost)::integer as avg_cost_per_km,
        CASE 
          WHEN previous_avg_cost > 0 
          THEN ROUND(((current_avg_cost - previous_avg_cost) / previous_avg_cost * 100))::integer
          ELSE 0 
        END as cost_trend
      FROM current_period, previous_period
    `,
        [companyId]
      );

      // Get expense overview
      const expenseMetrics = await client.query(
        `
      WITH current_period AS (
        SELECT COALESCE(SUM(total_amount), 0) as current_total
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE u.company_id = $1
        AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ),
      previous_period AS (
        SELECT COALESCE(SUM(total_amount), 0) as previous_total
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE u.company_id = $1
        AND e.created_at >= CURRENT_DATE - INTERVAL '60 days'
        AND e.created_at < CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT 
        current_total as total_expenses,
        CASE 
          WHEN previous_total > 0 
          THEN ROUND(((current_total - previous_total) / previous_total * 100))::integer
          ELSE 0 
        END as expense_trend
      FROM current_period, previous_period
    `,
        [companyId]
      );

      // Return the response with real data
      res.json({
        totalTeams: parseInt(teamsResult?.rows[0]?.total_teams || "0"),
        userLimit: parseInt(userLimitResult?.rows[0]?.user_limit || "50"),
        recentActivities: activitiesResult.rows,
        analytics: {
          teamPerformance: {
            value: performanceMetrics.rows[0]?.team_performance || 0,
            trend: `${
              performanceMetrics.rows[0]?.team_performance >= 0 ? "+" : ""
            }${performanceMetrics.rows[0]?.team_performance || 0}%`,
          },
          attendanceRate: {
            value: attendanceMetrics.rows[0]?.attendance_rate || 0,
            trend: `${
              attendanceMetrics.rows[0]?.attendance_rate >= 0 ? "+" : ""
            }${attendanceMetrics.rows[0]?.attendance_rate || 0}%`,
          },
          travelEfficiency: {
            value: travelMetrics.rows[0]?.avg_cost_per_km || 0,
            trend: `${travelMetrics.rows[0]?.cost_trend >= 0 ? "+" : ""}${
              travelMetrics.rows[0]?.cost_trend || 0
            }%`,
          },
          expenseOverview: {
            value: Math.round(expenseMetrics.rows[0]?.total_expenses || 0),
            trend: `${expenseMetrics.rows[0]?.expense_trend >= 0 ? "+" : ""}${
              expenseMetrics.rows[0]?.expense_trend || 0
            }%`,
          },
        },
      });
    } catch (err) {
      // Type assertion for error
      const error = err as Error;
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        user: req.user,
        companyId: req.user?.company_id,
      });
      res.status(500).json({
        error: "Failed to fetch dashboard stats",
        details: error.message,
      });
    } finally {
      client.release();
    }
  }
);

// Add this new endpoint for analytics data
router.get(
  "/analytics-data",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id || req.user.role !== "management") {
        return res.status(403).json({ error: "Access denied" });
      }

      const companyId = req.user.company_id;

      // Get performance data for last 6 months
      const performanceData = await client.query(
        `
      WITH RECURSIVE months AS (
        SELECT 
          date_trunc('month', CURRENT_DATE) as month
        UNION ALL
        SELECT 
          date_trunc('month', month - interval '1 month')
        FROM months
        WHERE date_trunc('month', month - interval '1 month') >= 
              date_trunc('month', CURRENT_DATE - interval '5 months')
      ),
      monthly_performance AS (
        SELECT 
          date_trunc('month', t.created_at) as month,
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
        FROM employee_tasks t
        JOIN users u ON t.assigned_to = u.id
        WHERE u.company_id = $1
        AND t.created_at >= CURRENT_DATE - interval '6 months'
        GROUP BY date_trunc('month', t.created_at)
      )
      SELECT 
        to_char(m.month, 'Mon') as month,
        COALESCE(
          ROUND((mp.completed_tasks::float / NULLIF(mp.total_tasks, 0) * 100))::integer,
          0
        ) as performance
      FROM months m
      LEFT JOIN monthly_performance mp ON m.month = mp.month
      ORDER BY m.month
    `,
        [companyId]
      );

      // Get attendance data for last 5 days
      const attendanceData = await client.query(
        `
      WITH RECURSIVE days AS (
        SELECT CURRENT_DATE as day
        UNION ALL
        SELECT day - 1
        FROM days
        WHERE day - 1 >= CURRENT_DATE - 4
      ),
      daily_attendance AS (
        SELECT 
          DATE(es.start_time) as day,
          COUNT(DISTINCT es.user_id) as present_users,
          (
            SELECT COUNT(DISTINCT u.id) 
            FROM users u
            LEFT JOIN users ga ON u.group_admin_id = ga.id
            WHERE u.company_id = $1 
            AND u.role = 'employee'
            AND ga.role = 'group-admin'
          ) as total_users
        FROM employee_shifts es
        JOIN users u ON es.user_id = u.id
        JOIN users ga ON u.group_admin_id = ga.id
        WHERE ga.company_id = $1
        AND es.start_time >= CURRENT_DATE - interval '5 days'
        AND es.end_time IS NOT NULL
        AND es.status = 'completed'
        GROUP BY DATE(es.start_time)
      )
      SELECT 
        to_char(d.day, 'Dy') as day,
        COALESCE(
          ROUND((da.present_users::float / NULLIF(da.total_users, 0) * 100))::integer,
          0
        ) as attendance_rate
      FROM days d
      LEFT JOIN daily_attendance da ON d.day = da.day
      ORDER BY d.day
    `,
        [companyId]
      );

      // Get key metrics
      const keyMetrics = await client.query(
        `
      WITH performance_stats AS (
        SELECT 
          ROUND(AVG(
            CASE 
              WHEN t.status = 'completed' THEN 100
              ELSE 0 
            END
          ))::integer as avg_performance
        FROM employee_tasks t
        JOIN users u ON t.assigned_to = u.id
        WHERE u.company_id = $1
        AND t.created_at >= CURRENT_DATE - interval '30 days'
      ),
      attendance_stats AS (
        SELECT 
          ROUND(
            (COUNT(DISTINCT CASE 
              WHEN es.end_time IS NOT NULL AND es.status = 'completed' 
              THEN es.user_id 
            END)::float / 
            NULLIF((
              SELECT COUNT(DISTINCT u.id) 
              FROM users u
              LEFT JOIN users ga ON u.group_admin_id = ga.id
              WHERE u.company_id = $1 
              AND u.role = 'employee'
              AND ga.role = 'group-admin'
            ), 0) * 100)
          )::integer as attendance_rate
        FROM employee_shifts es
        JOIN users u ON es.user_id = u.id
        JOIN users ga ON u.group_admin_id = ga.id
        WHERE ga.company_id = $1
        AND es.start_time >= CURRENT_DATE - interval '30 days'
      ),
      task_stats AS (
        SELECT 
          ROUND(
            (COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::float / 
            NULLIF(COUNT(*), 0) * 100)
          )::integer as completion_rate
        FROM employee_tasks t
        JOIN users u ON t.assigned_to = u.id
        WHERE u.company_id = $1
        AND t.created_at >= CURRENT_DATE - interval '30 days'
      ),
      efficiency_stats AS (
        SELECT 
          ROUND(AVG(
            CASE 
              WHEN total_kilometers > 0 AND total_amount > 0 
              THEN (total_amount / total_kilometers)
              ELSE NULL 
            END
          ))::integer as efficiency_score
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE u.company_id = $1
        AND e.created_at >= CURRENT_DATE - interval '30 days'
      )
      SELECT 
        ps.avg_performance,
        ast.attendance_rate,
        ts.completion_rate,
        LEAST(100, GREATEST(0, 
          ROUND(((es.efficiency_score - 10) / 20.0 * 100))
        ))::integer as team_efficiency
      FROM performance_stats ps
      CROSS JOIN attendance_stats ast
      CROSS JOIN task_stats ts
      CROSS JOIN efficiency_stats es
    `,
        [companyId]
      );

      res.json({
        performanceData: {
          labels: performanceData.rows.map((row) => row.month),
          datasets: [
            {
              data: performanceData.rows.map(
                (row) => Number(row.performance) || 0
              ),
            },
          ],
        },
        attendanceData: {
          labels: attendanceData.rows.map((row) => row.day),
          datasets: [
            {
              data: attendanceData.rows.map(
                (row) => Number(row.attendance_rate) || 0
              ),
            },
          ],
        },
        keyMetrics: {
          avgPerformance: {
            value: Number(keyMetrics.rows[0]?.avg_performance || 0),
            trend: "+2.5%",
          },
          attendanceRate: {
            value: Number(keyMetrics.rows[0]?.attendance_rate || 0),
            trend: "+1.2%",
          },
          taskCompletion: {
            value: Number(keyMetrics.rows[0]?.completion_rate || 0),
            trend: "+3.7%",
          },
          teamEfficiency: {
            value: Number(keyMetrics.rows[0]?.team_efficiency || 0),
            trend: "+1.5%",
          },
        },
      });
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      res.status(500).json({ error: "Failed to fetch analytics data" });
    } finally {
      client.release();
    }
  }
);

// Helper function to calculate trend percentage
function calculateTrend(previous: number, current: number): string {
  if (!previous) return "+0%";
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? "+" : ""}${Math.round(change)}%`;
}

// Start a new shift Group-Admin
// Add these new endpoints
router.post(
  "/shift/start",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { startTime } = req.body;
      const localStartTime = startTime
        ? convertToLocalTime(startTime)
        : "CURRENT_TIMESTAMP";

      // Start new shift with provided startTime
      const result = await client.query(
        `INSERT INTO management_shifts (user_id, start_time, status)
       VALUES ($1, $2::timestamp, 'active')
       RETURNING id, start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as start_time`,
        [req.user.id, localStartTime]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error starting shift:", error);
      res.status(500).json({ error: "Failed to start shift" });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/shift/end",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { endTime } = req.body;
      const localEndTime = endTime
        ? convertToLocalTime(endTime)
        : "CURRENT_TIMESTAMP";

      await client.query("BEGIN");

      // Get active shift
      const activeShift = await client.query(
        `SELECT id, start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as start_time 
       FROM management_shifts 
       WHERE user_id = $1 AND status = 'active'`,
        [req.user.id]
      );

      if (activeShift.rows.length === 0) {
        return res.status(404).json({ error: "No active shift found" });
      }

      // Get total expenses for this shift period
      const expenses = await client.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total_expenses
       FROM expenses
       WHERE user_id = $1 
       AND created_at BETWEEN $2 AND $3`,
        [req.user.id, activeShift.rows[0].start_time, localEndTime]
      );

      // End shift with provided endTime
      const result = await client.query(
        `UPDATE management_shifts 
       SET end_time = $1::timestamp,
           duration = $1::timestamp - start_time,
           status = 'completed',
           total_expenses = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING 
         id, 
         start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as start_time,
         end_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as end_time,
         duration,
         status,
         total_expenses`,
        [localEndTime, expenses.rows[0].total_expenses, activeShift.rows[0].id]
      );

      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error ending shift:", error);
      res.status(500).json({ error: "Failed to end shift" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/attendance/:month",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { month } = req.params;

      // Validate month format (should be YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res
          .status(400)
          .json({ error: "Invalid month format. Use YYYY-MM" });
      }

      // Add error logging
      console.log("Fetching attendance for:", {
        userId: req.user.id,
        month: month,
      });

      const result = await client.query(
        `WITH daily_totals AS (
        SELECT 
          DATE(start_time) as date,
          SUM(EXTRACT(EPOCH FROM duration)/3600) as total_hours,
          SUM(total_kilometers) as total_distance,
          SUM(total_expenses) as total_expenses,
          COUNT(*) as shift_count
        FROM management_shifts
        WHERE user_id = $1 
        AND DATE_TRUNC('month', start_time) = $2::date
        GROUP BY DATE(start_time)
      ),
      shift_details AS (
        SELECT 
          DATE(start_time) as date,
          json_agg(
            json_build_object(
              'shift_start', start_time,
              'shift_end', end_time,
              'total_hours', EXTRACT(EPOCH FROM duration)/3600,
              'total_distance', total_kilometers,
              'total_expenses', total_expenses
            ) ORDER BY start_time
          ) as shifts
        FROM management_shifts
        WHERE user_id = $1 
        AND DATE_TRUNC('month', start_time) = $2::date
        GROUP BY DATE(start_time)
      )
      SELECT 
        dt.date,
        dt.total_hours,
        dt.total_distance,
        dt.total_expenses,
        dt.shift_count,
        sd.shifts
      FROM daily_totals dt
      JOIN shift_details sd ON dt.date = sd.date
      ORDER BY dt.date DESC`,
        [req.user.id, month + "-01"]
      );

      // Add response logging
      console.log("Attendance query result:", {
        rowCount: result.rowCount,
        firstRow: result.rows[0],
      });

      res.json(result.rows);
    } catch (error) {
      console.error("Detailed error in attendance fetch:", error);
      res.status(500).json({
        error: "Failed to fetch attendance",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      client.release();
    }
  }
);

// Add this new endpoint to get recent shifts
router.get(
  "/shifts/recent",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await client.query(
        `SELECT 
        id,
        start_time AT TIME ZONE 'Asia/Kolkata' as start_time,
        end_time AT TIME ZONE 'Asia/Kolkata' as end_time,
        EXTRACT(EPOCH FROM duration)/3600 as duration,
        total_kilometers,
        total_expenses
      FROM management_shifts
      WHERE user_id = $1
      ORDER BY start_time DESC
      LIMIT 3`,
        [req.user.id]
      );

      // Add timezone information to the response
      const shiftsWithTimezone = result.rows.map((shift) => ({
        ...shift,
        timezone: "Asia/Kolkata",
      }));

      res.json(shiftsWithTimezone);
    } catch (error) {
      console.error("Error fetching recent shifts:", error);
      res.status(500).json({ error: "Failed to fetch recent shifts" });
    } finally {
      client.release();
    }
  }
);

export default router; 