import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';

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

// Check expense submission access
router.get('/check-expense-access', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await client.query(
      `SELECT 
        u.can_submit_expenses_anytime,
        u.shift_status,
        c.status as company_status
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { can_submit_expenses_anytime, shift_status, company_status } = result.rows[0];

    res.json({
      canSubmit: company_status === 'active' && (can_submit_expenses_anytime || shift_status === 'active'),
      companyActive: company_status === 'active',
      shiftActive: shift_status === 'active',
      canSubmitAnytime: can_submit_expenses_anytime
    });
  } catch (error) {
    console.error('Access check error:', error);
    res.status(500).json({ error: 'Failed to check access permissions' });
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
      `SELECT id, start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as start_time 
       FROM employee_shifts 
       WHERE user_id = $1 AND status = 'active'`,
      [req.user.id]
    );

    if (activeShift.rows.length === 0) {
      return res.status(404).json({ error: 'No active shift found' });
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
      `UPDATE employee_shifts 
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
        start_time,
        end_time,
        EXTRACT(EPOCH FROM duration)/3600 as duration,
        total_kilometers,
        total_expenses
      FROM employee_shifts
      WHERE user_id = $1
      ORDER BY start_time DESC
      LIMIT 3`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent shifts:', error);
    res.status(500).json({ error: 'Failed to fetch recent shifts' });
  } finally {
    client.release();
  }
});

export default router; 