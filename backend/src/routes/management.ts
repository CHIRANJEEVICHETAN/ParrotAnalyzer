import express, { Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { pool } from '../config/database';
import { CustomRequest } from '../types';
import multer from 'multer';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get management profile data
router.get('/profile', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await client.query(`
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
    `, [req.user.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];
    
    // Convert profile_image to base64 if it exists
    if (profile.profile_image) {
      profile.profile_image = profile.profile_image.toString('base64');
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching management profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  } finally {
    client.release();
  }
});

// Update management profile
router.put('/profile', authMiddleware, upload.single('profileImage'), async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, phone } = req.body;
    const profileImage = req.file?.buffer;

    await client.query('BEGIN');

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
    
    query += ` WHERE id = $${values.length + 1} AND role = 'management' RETURNING id`;
    values.push(req.user.id);

    const updateResult = await client.query(query, values);

    if (!updateResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get updated profile with company information
    const profileResult = await client.query(`
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
    `, [updateResult.rows[0].id]);

    await client.query('COMMIT');

    const updatedProfile = profileResult.rows[0];
    
    // Convert profile_image to base64 if it exists
    if (updatedProfile.profile_image) {
      updatedProfile.profile_image = updatedProfile.profile_image.toString('base64');
    }

    res.json(updatedProfile);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating management profile:', error);
    res.status(500).json({ 
      error: 'Failed to update profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Add this new endpoint
router.get('/dashboard-stats', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id || req.user.role !== 'management') {
      console.log('Access denied:', { userId: req.user?.id, role: req.user?.role });
      return res.status(403).json({ error: 'Access denied' });
    }

    const companyId = req.user.company_id;
    console.log('Fetching stats for company:', companyId);

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
      console.log('Teams query successful:', teamsResult.rows[0]);
    } catch (error) {
      console.error('Teams query failed:', error);
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
      console.log('User limit query successful:', userLimitResult.rows[0]);
    } catch (error) {
      console.error('User limit query failed:', error);
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
      console.log('employee_tasks table exists:', tableCheck.rows[0].exists);
    } catch (error) {
      console.error('Table check failed:', error);
    }

    // Update the activities query
    const activitiesResult = await client.query(`
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
    `, [companyId]);

    // Get performance metrics (based on tasks)
    const performanceMetrics = await client.query(`
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
    `, [companyId]);

    // Get attendance metrics
    const attendanceMetrics = await client.query(`
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
    `, [companyId]);

    // Get travel efficiency metrics
    const travelMetrics = await client.query(`
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
    `, [companyId]);

    // Get expense overview
    const expenseMetrics = await client.query(`
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
    `, [companyId]);

    // Return the response with real data
    res.json({
      totalTeams: parseInt(teamsResult?.rows[0]?.total_teams || '0'),
      userLimit: parseInt(userLimitResult?.rows[0]?.user_limit || '50'),
      recentActivities: activitiesResult.rows,
      analytics: {
        teamPerformance: {
          value: performanceMetrics.rows[0]?.team_performance || 0,
          trend: `${performanceMetrics.rows[0]?.team_performance >= 0 ? '+' : ''}${performanceMetrics.rows[0]?.team_performance || 0}%`
        },
        attendanceRate: {
          value: attendanceMetrics.rows[0]?.attendance_rate || 0,
          trend: `${attendanceMetrics.rows[0]?.attendance_rate >= 0 ? '+' : ''}${attendanceMetrics.rows[0]?.attendance_rate || 0}%`
        },
        travelEfficiency: {
          value: travelMetrics.rows[0]?.avg_cost_per_km || 0,
          trend: `${travelMetrics.rows[0]?.cost_trend >= 0 ? '+' : ''}${travelMetrics.rows[0]?.cost_trend || 0}%`
        },
        expenseOverview: {
          value: Math.round(expenseMetrics.rows[0]?.total_expenses || 0),
          trend: `${expenseMetrics.rows[0]?.expense_trend >= 0 ? '+' : ''}${expenseMetrics.rows[0]?.expense_trend || 0}%`
        }
      }
    });

  } catch (err) {
    // Type assertion for error
    const error = err as Error;
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      user: req.user,
      companyId: req.user?.company_id
    });
    res.status(500).json({ 
      error: 'Failed to fetch dashboard stats',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// Helper function to calculate trend percentage
function calculateTrend(previous: number, current: number): string {
  if (!previous) return '+0%';
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${Math.round(change)}%`;
}

export default router; 