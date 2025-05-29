import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { format } from 'date-fns';
// import { sendAttendanceToSparrow, getEmployeeCode } from '../services/sparrowAttendanceService'; // Uncomment Later When needed

const router = express.Router();

// Add this helper function at the top
const convertToLocalTime = (isoString: string) => {
  return isoString.replace(/Z$/, '');  // Remove Z suffix to treat as local time
};

// Get employee details
router.get('/details', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userResult = await client.query(
      `SELECT role FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!userResult.rows.length || userResult.rows[0].role !== 'employee') {
      return res.status(403).json({ error: 'Access denied. Employee only.' });
    }

    const result = await client.query(
      `SELECT 
        u.name,
        u.employee_number,
        u.department,
        u.designation,
        c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1 AND u.role = 'employee'`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee details not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch employee details' });
  } finally {
    client.release();
  }
});

// Add these new endpoints
router.post('/shift/start', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { startTime } = req.body;
    const localStartTime = startTime ? convertToLocalTime(startTime) : 'CURRENT_TIMESTAMP';

    // Start new shift with provided startTime
    const result = await client.query(
      `INSERT INTO employee_shifts (user_id, start_time, status)
       VALUES ($1, $2::timestamp, 'active')
       RETURNING id, start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as start_time`,
      [req.user.id, localStartTime]
    );

    // Send attendance to Sparrow Uncomment Later When needed
    // const employeeCode = await getEmployeeCode(req.user.id);
    // if (employeeCode) {
    //   await sendAttendanceToSparrow([employeeCode]);
    // }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error starting shift:', error);
    res.status(500).json({ error: 'Failed to start shift' });
  } finally {
    client.release();
  }
});

router.post('/shift/end', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { endTime } = req.body;
    const localEndTime = endTime ? convertToLocalTime(endTime) : 'CURRENT_TIMESTAMP';

    await client.query('BEGIN');

    // Get active shift
    const activeShift = await client.query(
      `SELECT id, start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as start_time,
              total_kilometers, total_expenses
       FROM employee_shifts 
       WHERE user_id = $1 AND status = 'active'`,
      [req.user.id]
    );

    if (activeShift.rows.length === 0) {
      return res.status(404).json({ error: 'No active shift found' });
    }

    // Use the current expense value from the active shift instead of recalculating
    // This preserves expenses submitted during the shift
    const currentExpenses = parseFloat(activeShift.rows[0].total_expenses || '0');
    const currentKilometers = parseFloat(activeShift.rows[0].total_kilometers || '0');
    
    console.log('Ending shift with expenses and kilometers:', {
      shiftId: activeShift.rows[0].id,
      currentExpenses,
      currentKilometers
    });

    // End shift with provided endTime, preserving the current expenses
    const result = await client.query(
      `UPDATE employee_shifts 
       SET end_time = $1::timestamp,
           duration = $1::timestamp - start_time,
           status = 'completed',
           total_expenses = $2,
           total_kilometers = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING 
         id, 
         start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as start_time,
         end_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as end_time,
         duration,
         status,
         total_expenses,
         total_kilometers`,
      [localEndTime, currentExpenses, currentKilometers, activeShift.rows[0].id]
    );

    // Send attendance to Sparrow Uncomment Later When needed
    // const employeeCode = await getEmployeeCode(req.user.id);
    // if (employeeCode) {
    //   await sendAttendanceToSparrow([employeeCode]);
    // }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error ending shift:', error);
    res.status(500).json({ error: 'Failed to end shift' });
  } finally {
    client.release();
  }
});

router.get('/attendance/:month', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { month } = req.params;
    
    // Validate month format (should be YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    }

    // Add error logging
    console.log('Fetching attendance for:', {
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
        FROM employee_shifts
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
        FROM employee_shifts
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
      [req.user.id, month + '-01']
    );

    // Add response logging
    console.log('Attendance query result:', {
      rowCount: result.rowCount,
      firstRow: result.rows[0],
    });

    res.json(result.rows);
  } catch (error) {
    console.error('Detailed error in attendance fetch:', error);
    res.status(500).json({ 
      error: 'Failed to fetch attendance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Add this new endpoint to get recent shifts
router.get('/shifts/recent', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await client.query(
      `SELECT 
        id,
        start_time AT TIME ZONE 'Asia/Kolkata' as start_time,
        end_time AT TIME ZONE 'Asia/Kolkata' as end_time,
        EXTRACT(EPOCH FROM duration)/3600 as duration,
        total_kilometers,
        total_expenses
      FROM employee_shifts
      WHERE user_id = $1
      ORDER BY start_time DESC
      LIMIT 3`,
      [req.user.id]
    );

    // Add timezone information to the response
    const shiftsWithTimezone = result.rows.map(shift => ({
      ...shift,
      timezone: 'Asia/Kolkata'
    }));

    res.json(shiftsWithTimezone);
  } catch (error) {
    console.error('Error fetching recent shifts:', error);
    res.status(500).json({ error: 'Failed to fetch recent shifts' });
  } finally {
    client.release();
  }
});

// Add this new endpoint for group admin attendance tracking
router.get('/admin/attendance/:month', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user || req.user.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group Admin only.' });
    }

    const { month } = req.params;
    const employee_id = typeof req.query.employee_id === 'string' ? req.query.employee_id : undefined;

    // First get all employees
    const employeesResult = await client.query(
      `SELECT id, name, employee_number 
       FROM users 
       WHERE group_admin_id = $1 
       AND role = 'employee'
       ORDER BY name ASC`,
      [req.user.id]
    );

    // Then get attendance data from employee_shifts table
    let query = `
      WITH daily_stats AS (
        SELECT 
          u.id as user_id,
          u.name as employee_name,
          u.employee_number,
          DATE(es.start_time) as date,
          COUNT(*) as shift_count,
          SUM(
            CASE 
              WHEN es.end_time IS NULL THEN 0  -- Don't count hours for active shifts
              ELSE EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600
            END
          ) as total_hours,
          SUM(COALESCE(es.total_kilometers, 0)) as total_distance,
          SUM(COALESCE(es.total_expenses, 0)) as total_expenses,
          jsonb_agg(
            jsonb_build_object(
              'shift_start', es.start_time,
              'shift_end', es.end_time,
              'duration', CASE 
                WHEN es.end_time IS NULL THEN NULL  -- NULL duration for active shifts
                ELSE EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600
              END,
              'status', es.status,
              'total_kilometers', COALESCE(es.total_kilometers, 0),
              'total_expenses', COALESCE(es.total_expenses, 0)
            )
          ) as shifts
        FROM users u
        LEFT JOIN employee_shifts es ON es.user_id = u.id
        WHERE u.group_admin_id = $1
        AND TO_CHAR(es.start_time, 'YYYY-MM') = $2
        GROUP BY u.id, u.name, u.employee_number, DATE(es.start_time)
      )
      SELECT 
        user_id,
        employee_name,
        employee_number,
        date,
        shift_count,
        ROUND(total_hours::numeric, 2) as total_hours,
        ROUND(total_distance::numeric, 2) as total_distance,
        ROUND(total_expenses::numeric, 2) as total_expenses,
        shifts
      FROM daily_stats
    `;

    const queryParams: (string | number)[] = [req.user.id, month];

    if (employee_id) {
      query += ` WHERE user_id = $3`;
      queryParams.push(parseInt(employee_id));
    }

    query += ` ORDER BY date DESC, employee_name ASC`;

    const result = await client.query(query, queryParams);

    // Group the results by date
    const groupedAttendance = result.rows.reduce((acc: any, curr) => {
      const dateKey = format(new Date(curr.date), 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push({
        ...curr,
        id: parseInt(`${curr.user_id}${dateKey.replace(/-/g, '')}`), // Generate unique ID
        shifts: curr.shifts || []
      });
      return acc;
    }, {});

    res.json({
      attendance: groupedAttendance,
      employees: employeesResult.rows
    });
  } catch (error) {
    console.error('Error fetching admin attendance:', error);
    res.status(500).json({ 
      error: 'Failed to fetch attendance data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get profile stats and recent activities
router.get('/profile-stats', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user's group admin name
    const groupAdminResult = await client.query(`
      SELECT 
        ga.name as group_admin_name 
      FROM users u
      JOIN users ga ON u.group_admin_id = ga.id
      WHERE u.id = $1`,
      [userId]
    );

    // Get total hours worked this month
    const hoursResult = await client.query(`
      SELECT COALESCE(
        ROUND(
          SUM(
            EXTRACT(EPOCH FROM (end_time - start_time))/3600
          )::numeric, 
          1
        ),
        0
      ) as total_hours
      FROM employee_shifts
      WHERE user_id = $1
      AND DATE_TRUNC('month', start_time) = DATE_TRUNC('month', CURRENT_DATE)
    `, [userId]);

    // Get expense count
    const expensesResult = await client.query(`
      SELECT COUNT(*)::text as expense_count
      FROM expenses
      WHERE user_id = $1
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    `, [userId]);

    // Get attendance rate
    const attendanceResult = await client.query(`
      SELECT 
        COALESCE(COUNT(DISTINCT DATE(start_time)), 0) as days_present,
        COALESCE(COUNT(DISTINCT CASE WHEN status = 'late' THEN DATE(start_time) END), 0) as days_late
      FROM employee_shifts
      WHERE user_id = $1
      AND DATE_TRUNC('month', start_time) = DATE_TRUNC('month', CURRENT_DATE)
    `, [userId]);

    // Get completed tasks
    const tasksResult = await client.query(`
      SELECT COUNT(*)::text as completed_tasks
      FROM employee_tasks
      WHERE assigned_to = $1
      AND status = 'completed'
      AND updated_at >= CURRENT_DATE - INTERVAL '30 days'
    `, [userId]);

    // Get recent activities with proper error handling
    const activitiesResult = await client.query(`
      (
        SELECT 
          'shift' as type,
          CASE 
            WHEN status = 'late' THEN 'Late Check-in'
            ELSE 'Shift Completed'
          END as title,
          CONCAT(
            'Duration: ',
            COALESCE(
              ROUND(
                EXTRACT(EPOCH FROM (end_time - start_time))/3600
              ::numeric, 
              1
            ),
            0
          ),
            ' hours'
          ) as description,
          start_time as time
        FROM employee_shifts
        WHERE user_id = $1
        AND start_time >= CURRENT_DATE - INTERVAL '30 days'

        UNION ALL

        SELECT 
          'expense' as type,
          'Expense ' || COALESCE(status, 'submitted') as title,
          CONCAT('Amount: ₹', COALESCE(total_amount, 0)) as description,
          created_at as time
        FROM expenses
        WHERE user_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'

        UNION ALL

        SELECT 
          'task' as type,
          'Task ' || COALESCE(status, 'updated') as title,
          COALESCE(title, 'Task updated') as description,
          updated_at as time
        FROM employee_tasks
        WHERE assigned_to = $1
        AND updated_at >= CURRENT_DATE - INTERVAL '30 days'
      )
      ORDER BY time DESC
      LIMIT 5
    `, [userId]);

    // Calculate attendance rate with proper handling
    const workingDays = 22; // Assuming 22 working days per month
    const daysPresent = parseInt(attendanceResult.rows[0].days_present) || 0;
    const attendanceRate = ((daysPresent / workingDays) * 100).toFixed(1) + '%';

    const stats = {
      totalHours: hoursResult.rows[0].total_hours.toString(),
      expenseCount: expensesResult.rows[0].expense_count.toString(),
      attendanceRate: attendanceRate,
      completedTasks: tasksResult.rows[0].completed_tasks.toString(),
      groupAdminName: groupAdminResult.rows[0]?.group_admin_name || null
    };

    res.json({
      stats,
      recentActivities: activitiesResult.rows
    });

  } catch (error) {
    console.error('Error details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profile stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Add this new endpoint to check shift access
router.get('/check-shift-access', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has any active shift and their expense submission permission
    const result = await client.query(`
      SELECT 
        u.can_submit_expenses_anytime,
        EXISTS (
          SELECT 1 
          FROM employee_shifts 
          WHERE user_id = u.id 
          AND status = 'active'
          AND end_time IS NULL
        ) as has_active_shift
      FROM users u
      WHERE u.id = $1
    `, [req.user.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { can_submit_expenses_anytime, has_active_shift } = result.rows[0];

    // User can access if they either:
    // 1. Have permission to submit anytime, OR
    // 2. Have an active shift
    const canAccess = can_submit_expenses_anytime || has_active_shift;

    res.json({
      canAccess,
      has_active_shift,
      can_submit_expenses_anytime
    });

  } catch (error) {
    console.error('Error checking shift access:', error);
    res.status(500).json({ error: 'Failed to check shift access' });
  } finally {
    client.release();
  }
});

// Add this new endpoint to get user permissions
router.get('/permissions', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get basic user permissions from users table
    const userResult = await client.query(
      `SELECT 
        can_submit_expenses_anytime,
        role
      FROM users
      WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get geofence-related permissions from user_tracking_permissions table
    const trackingResult = await client.query(
      `SELECT 
        can_override_geofence
      FROM user_tracking_permissions
      WHERE user_id = $1`,
      [req.user.id]
    );

    // Initialize permissions array
    const permissions = [];

    // Add basic permissions
    if (userResult.rows[0].can_submit_expenses_anytime) {
      permissions.push('can_submit_expenses_anytime');
    }

    // Add tracking permissions if they exist
    if (trackingResult.rows.length > 0 && trackingResult.rows[0].can_override_geofence) {
      permissions.push('can_override_geofence');
    }

    // Check for role-based permissions (e.g., group-admin and management roles may override geofence by default)
    const isManagementRole = ['management', 'super-admin', 'group-admin'].includes(userResult.rows[0].role);
    if (isManagementRole && !permissions.includes('can_override_geofence')) {
      permissions.push('can_override_geofence');
    }

    // Return the permissions array
    res.json({
      permissions
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch permissions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

export default router; 