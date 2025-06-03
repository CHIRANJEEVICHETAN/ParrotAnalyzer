import express, { Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware, adminMiddleware, verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { format } from 'date-fns';

// Add type definitions
interface Report {
  id: number;
  type: 'expense' | 'attendance' | 'activity';
  title: string;
  date: Date | string;
  amount: number | null;
  status: string | null;
}

interface DatabaseError {
  message?: string;
  code?: string;
  position?: string;
  detail?: string;
  severity?: string;
  hint?: string;
  internalPosition?: string;
  internalQuery?: string;
  where?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  file?: string;
  line?: string;
  routine?: string;
}

const router = express.Router();

// Get all reports for a group admin
router.get('/', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;
    
    // Get reports from different tables
    try {
      // Get expense reports
      const expenseReports = await client.query<Report>(
        `SELECT 
          CONCAT('exp_', id) as id,
          'expense' as type,
          'Expense Report' as title,
          COALESCE(date, created_at)::timestamp as date,
          COALESCE(total_amount, 0) as amount,
          COALESCE(status, 'pending') as status
         FROM expenses 
         WHERE group_admin_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [adminId]
      );

      // Get attendance reports
      const attendanceReports = await client.query<Report>(
        `SELECT 
          CONCAT('att_', id) as id,
          'attendance' as type,
          'Attendance Report' as title,
          date::timestamp as date,
          NULL as amount,
          COALESCE(status, 'pending') as status
         FROM employee_schedule 
         WHERE user_id IN (
           SELECT id FROM users WHERE group_admin_id = $1
         )
         ORDER BY date DESC 
         LIMIT 5`,
        [adminId]
      );

      // Get activity reports (from tasks)
      const activityReports = await client.query<Report>(
        `SELECT 
          CONCAT('act_', id) as id,
          'activity' as type,
          'Task Report' as title,
          created_at::timestamp as date,
          NULL as amount,
          COALESCE(status, 'pending') as status
         FROM employee_tasks 
         WHERE assigned_by = $1
         ORDER BY created_at DESC 
         LIMIT 5`,
        [adminId]
      );

      // Add type assertion for combined reports
      const allReports = [
        ...expenseReports.rows,
        ...attendanceReports.rows,
        ...activityReports.rows
      ].sort((a: Report, b: Report) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA;
      });

      res.json(allReports.slice(0, 10));

    } catch (dbError: unknown) {
      console.error('Database query error:', dbError);
      const error = dbError as DatabaseError;
      res.status(500).json({ 
        error: 'Database error', 
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          detail: error.detail,
          hint: error.hint
        } : undefined 
      });
    }
  } catch (error: unknown) {
    console.error('Error fetching reports:', error);
    const err = error as Error;
    res.status(500).json({ 
      error: 'Failed to fetch reports',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    client.release();
  }
});

// Add these new endpoints for expense reports
router.get('/expenses/overview', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;
    
    // Extract filter parameters
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // Default to 6 months ago
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    const department = req.query.department as string;

    // First check if category column exists and add it if it doesn't
    try {
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'expenses' 
            AND column_name = 'category'
          ) THEN
            ALTER TABLE expenses ADD COLUMN category VARCHAR(50);
            
            UPDATE expenses 
            SET category = 
              CASE 
                WHEN vehicle_type IS NOT NULL THEN 'Travel'
                WHEN lodging_expenses > 0 THEN 'Accommodation'
                WHEN daily_allowance > 0 THEN 'Food'
                WHEN diesel > 0 THEN 'Travel'
                WHEN toll_charges > 0 THEN 'Travel'
                ELSE 'Other'
              END
            WHERE category IS NULL;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.error('Error checking/adding category column:', err);
    }

    // Build parameters array
    const baseParams: Array<string | number | Date> = [adminId, startDate, endDate];
    
    if (employeeId) {
      baseParams.push(employeeId);
    }
    
    if (department) {
      baseParams.push(department);
    }

    // Monthly data query with error handling
    let monthlyData;
    try {
      monthlyData = await client.query(`
        SELECT 
          TO_CHAR(date, 'Mon') as month,
          COALESCE(SUM(total_amount), 0) as amount
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= $2
        AND date <= $3
        ${employeeId ? ' AND user_id = $4' : ''}
        ${department ? ' AND user_id IN (SELECT id FROM users WHERE department = $5)' : ''}
        GROUP BY TO_CHAR(date, 'Mon')
        ORDER BY MIN(date)
      `, baseParams);
    } catch (err) {
      console.error('Error fetching monthly data:', err);
      monthlyData = { rows: [] };
    }

    // Update category data query to use specific expense columns
    const categoryData = await client.query(`
      WITH category_totals AS (
        SELECT 
          'Lodging' as name,
          COALESCE(SUM(lodging_expenses), 0) as population
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= $2
        AND date <= $3
        ${employeeId ? ` AND user_id = $4` : ''}
        ${department ? ` AND user_id IN (SELECT id FROM users WHERE department = $5)` : ''}
        AND lodging_expenses > 0
        
        UNION ALL
        
        SELECT 
          'Daily Allowance' as name,
          COALESCE(SUM(daily_allowance), 0) as population
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= $2
        AND date <= $3
        ${employeeId ? ` AND user_id = $4` : ''}
        ${department ? ` AND user_id IN (SELECT id FROM users WHERE department = $5)` : ''}
        AND daily_allowance > 0
        
        UNION ALL
        
        SELECT 
          'Fuel' as name,
          COALESCE(SUM(diesel), 0) as population
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= $2
        AND date <= $3
        ${employeeId ? ` AND user_id = $4` : ''}
        ${department ? ` AND user_id IN (SELECT id FROM users WHERE department = $5)` : ''}
        AND diesel > 0
        
        UNION ALL
        
        SELECT 
          'Toll' as name,
          COALESCE(SUM(toll_charges), 0) as population
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= $2
        AND date <= $3
        ${employeeId ? ` AND user_id = $4` : ''}
        ${department ? ` AND user_id IN (SELECT id FROM users WHERE department = $5)` : ''}
        AND toll_charges > 0
        
        UNION ALL
        
        SELECT 
          'Other' as name,
          COALESCE(SUM(other_expenses), 0) as population
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= $2
        AND date <= $3
        ${employeeId ? ` AND user_id = $4` : ''}
        ${department ? ` AND user_id IN (SELECT id FROM users WHERE department = $5)` : ''}
        AND other_expenses > 0
      )
      SELECT 
        name,
        population,
        CASE 
          WHEN SUM(population) OVER () > 0 
          THEN ROUND((population / SUM(population) OVER ()) * 100, 1)
          ELSE 0 
        END as percentage
      FROM category_totals
      WHERE population > 0
      ORDER BY population DESC
    `, baseParams);

    // Remove the manual percentage calculation since it's now part of the query
    const processedCategoryData = categoryData.rows.map(row => ({
      name: row.name,
      population: parseFloat(row.population),
      percentage: row.percentage,
      color: getCategoryColor(row.name),
      legendFontColor: '#7F7F7F',
      legendFontSize: 12
    }));

    console.log('Processed category data:', processedCategoryData);

    // Summary data query with error handling
    let summaryData;
    try {
      summaryData = await client.query(`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(total_amount), 0) as total_amount,
          COALESCE(ROUND(AVG(total_amount), 2), 0) as average_expense,
          COALESCE(MAX(total_amount), 0) as highest_expense,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= $2
        AND date <= $3
        ${employeeId ? ` AND user_id = $4` : ''}
        ${department ? ` AND user_id IN (SELECT id FROM users WHERE department = $5)` : ''}
      `, baseParams);
    } catch (err) {
      console.error('Error fetching summary data:', err);
      summaryData = {
        rows: [{
          total_count: 0,
          total_amount: 0,
          average_expense: 0,
          highest_expense: 0,
          approved_count: 0,
          rejected_count: 0,
          pending_count: 0
        }]
      };
    }

    console.log('Sending response:', {
      monthlyData: monthlyData.rows,
      categoryData: processedCategoryData,
      summary: summaryData.rows[0]
    });

    res.json({
      monthlyData: monthlyData.rows,
      categoryData: processedCategoryData,
      summary: summaryData.rows[0]
    });

  } catch (error) {
    console.error('Error fetching expense overview:', error);
    // Send a structured error response
    res.status(500).json({
      error: 'Failed to fetch expense overview',
      monthlyData: [],
      categoryData: [],
      summary: {
        total_count: 0,
        total_amount: 0,
        average_expense: 0,
        highest_expense: 0,
        approved_count: 0,
        rejected_count: 0,
        pending_count: 0
      }
    });
  } finally {
    client.release();
  }
});

// Add this new endpoint for employee expense stats
router.get('/expenses/employee-stats', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Extract filter parameters
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // Default to 6 months ago
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    const department = req.query.department as string;

    // First get all employees under this admin
    const employeeQuery = `
      SELECT id, name, employee_number, department
      FROM users 
      WHERE group_admin_id = $1 AND role = 'employee'
      ${department ? 'AND department = $2' : ''}
      ORDER BY name ASC`;

    const employeeParams = department ? [req.user.id, department] : [req.user.id];
    const employees = await client.query(employeeQuery, employeeParams);

    // Build additional filter conditions for expenses query
    let additionalFilters = '';
    const queryParams: Array<string | number | Date> = [req.user.id, startDate, endDate];
    let paramIndex = 4; // Start from 4 since we have 3 parameters already

    if (employeeId) {
      additionalFilters += ` AND user_id = $${paramIndex}`;
      queryParams.push(employeeId);
    }

    // Get expense stats for selected employee or all employees
    const expenseQuery = `
      SELECT 
        u.id as employee_id,
        u.name as employee_name,
        u.employee_number,
        TO_CHAR(DATE_TRUNC('month', e.date), 'Mon') as month,
        COUNT(*) as expense_count,
        SUM(e.total_amount) as total_amount,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN e.status = 'rejected' THEN 1 END) as rejected_count,
        SUM(e.lodging_expenses) as lodging_expenses,
        SUM(e.daily_allowance) as daily_allowance,
        SUM(e.diesel) as diesel,
        SUM(e.toll_charges) as toll_charges,
        SUM(e.other_expenses) as other_expenses
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1
      AND e.date >= $2
      AND e.date <= $3
      ${additionalFilters}
      GROUP BY u.id, u.name, u.employee_number, DATE_TRUNC('month', e.date)
      ORDER BY DATE_TRUNC('month', e.date) ASC`;

    const expenseStats = await client.query(expenseQuery, queryParams);

    // Process the stats to include category data
    const processedStats = expenseStats.rows.map(row => {
      const categoryData = [
        { name: 'Lodging', amount: parseFloat(row.lodging_expenses) || 0 },
        { name: 'Daily Allowance', amount: parseFloat(row.daily_allowance) || 0 },
        { name: 'Fuel', amount: parseFloat(row.diesel) || 0 },
        { name: 'Toll', amount: parseFloat(row.toll_charges) || 0 },
        { name: 'Other', amount: parseFloat(row.other_expenses) || 0 }
      ].filter(cat => cat.amount > 0);

      const total = categoryData.reduce((sum, cat) => sum + cat.amount, 0);

      return {
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        employee_number: row.employee_number,
        month: row.month,
        expense_count: parseInt(row.expense_count),
        total_amount: parseFloat(row.total_amount),
        approved_count: parseInt(row.approved_count),
        rejected_count: parseInt(row.rejected_count),
        categoryData: categoryData.map(cat => ({
          name: cat.name,
          population: cat.amount,
          percentage: ((cat.amount / total) * 100).toFixed(1),
          color: getCategoryColor(cat.name),
          legendFontColor: '#7F7F7F',
          legendFontSize: 12
        }))
      };
    });

    res.json({
      employees: employees.rows,
      expenseStats: processedStats
    });

  } catch (error) {
    console.error('Error fetching employee expense stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch employee expense stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Add this new endpoint for report analytics
router.get('/analytics', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;

    // Get expense analytics with error handling
    let expenseAnalytics;
    try {
      expenseAnalytics = await client.query(`
        WITH current_month AS (
          SELECT 
            COALESCE(SUM(total_amount), 0)::numeric as total,
            COALESCE(AVG(NULLIF(total_amount, 0)), 0)::numeric as average,
            SUM(total_amount) as current_month_total
          FROM expenses 
          WHERE group_admin_id = $1 
          AND date >= DATE_TRUNC('month', CURRENT_DATE)
        ),
        previous_month AS (
          SELECT 
            SUM(total_amount) as previous_month_total
          FROM expenses 
          WHERE group_admin_id = $1 
          AND date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND date < DATE_TRUNC('month', CURRENT_DATE)
        )
        SELECT 
          ROUND(COALESCE(cm.total, 0)::numeric, 2) as total,
          ROUND(COALESCE(cm.average, 0)::numeric, 2) as average,
          COALESCE(cm.current_month_total, 0) as currentMonthTotal,
          COALESCE(pm.previous_month_total, 0) as previousMonthTotal
        FROM current_month cm
        CROSS JOIN previous_month pm`,
        [adminId]
      );
    } catch (err) {
      console.error('Error in expense analytics query:', err);
      expenseAnalytics = {
        rows: [{
          total: 0,
          average: 0,
          currentMonthTotal: 0,
          previousMonthTotal: 0
        }]
      };
    }

    // Get attendance analytics with fallback
    let attendanceAnalytics;
    try {
      attendanceAnalytics = await client.query(`
        WITH employee_count AS (
          SELECT COUNT(*) as total_employees
        FROM users 
          WHERE group_admin_id = $1 AND role = 'employee'
        ),
        attendance_data AS (
          SELECT 
            DATE(start_time) as date,
            COUNT(DISTINCT user_id) as attended
          FROM employee_shifts
          WHERE start_time >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY DATE(start_time)
        )
        SELECT 
          e.total_employees as total,
          ROUND(AVG(a.attended)::numeric, 2) as average,
          ROUND((AVG(a.attended) / NULLIF(e.total_employees, 0) * 100)::numeric, 1) || '%' as trend
        FROM employee_count e
        LEFT JOIN attendance_data a ON true
        GROUP BY e.total_employees`,
        [adminId]
      );
    } catch (err) {
      console.error('Error in attendance analytics query:', err);
      attendanceAnalytics = {
        rows: [{
          total: 0,
          average: 0,
          trend: '0%'
        }]
      };
    }

    // Add Task Analytics
    const taskCurrentMonth = await client.query(`
      SELECT COUNT(*) as count
      FROM employee_tasks
      WHERE assigned_by = $1
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `, [adminId]);

    const taskPreviousMonth = await client.query(`
      SELECT COUNT(*) as count
      FROM employee_tasks
      WHERE assigned_by = $1
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      AND created_at < DATE_TRUNC('month', CURRENT_DATE)
    `, [adminId]);

    // Updated metrics query to properly calculate average completion time
    const taskMetrics = await client.query(`
      WITH task_stats AS (
        SELECT 
          COUNT(*) as total_tasks,
          (COUNT(*)::decimal / 30.0) as avg_tasks_per_day
        FROM employee_tasks
        WHERE assigned_by = $1
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT 
        total_tasks,
        ROUND(avg_tasks_per_day::numeric, 2) as avg_completion_time
      FROM task_stats
    `, [adminId]);

    // Add debug logging
    console.log('Task Metrics Raw:', taskMetrics.rows[0]);
    console.log('Task Average:', {
      total: taskMetrics.rows[0]?.total_tasks,
      average: taskMetrics.rows[0]?.avg_completion_time,
      avgNumber: Number(taskMetrics.rows[0]?.avg_completion_time || 0)
    });

    // Get travel analytics
    const travelMetrics = await client.query(`
      SELECT 
        COUNT(*) as total_trips,
        ROUND(AVG(total_amount)::numeric, 2) as avg_trip_cost,
        SUM(total_amount) as current_month_total,
        (
          SELECT SUM(total_amount)
          FROM expenses
          WHERE group_admin_id = $1
          AND date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND date < DATE_TRUNC('month', CURRENT_DATE)
        ) as previous_month_total
      FROM expenses
      WHERE group_admin_id = $1
      AND date >= DATE_TRUNC('month', CURRENT_DATE)
    `, [adminId]);

    // Add Performance Analytics
    const performanceMetrics = await client.query(`
      WITH employee_metrics AS (
        SELECT 
          COUNT(DISTINCT u.id) as total_employees,
          ROUND(AVG(
            CASE WHEN es.status = 'completed' 
            THEN EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600 
            END
          )::numeric, 2) as avg_performance_score
        FROM users u
        LEFT JOIN employee_shifts es ON es.user_id = u.id
          AND es.created_at >= CURRENT_DATE - INTERVAL '30 days'
        WHERE u.group_admin_id = $1 AND u.role = 'employee'
      ),
      performance_trend AS (
        SELECT 
          COUNT(DISTINCT user_id) as current_active,
          AVG(EXTRACT(EPOCH FROM (end_time - start_time))/3600) as current_hours
        FROM employee_shifts
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
        AND status = 'completed'
      )
      SELECT 
        em.total_employees,
        COALESCE(em.avg_performance_score, 0) as avg_performance_score,
        COALESCE(pt.current_active, 0) as active_employees,
        COALESCE(pt.current_hours, 0) as avg_hours
      FROM employee_metrics em
      CROSS JOIN performance_trend pt
    `, [adminId]);
    console.log('Performance Metrics:', performanceMetrics.rows[0]);

    // Add Leave Analytics
    const leaveMetrics = await client.query(`
      WITH monthly_stats AS (
        SELECT 
          COUNT(*) as total_requests,
          COUNT(DISTINCT user_id) as total_users,
          ROUND(AVG(
            CASE WHEN status = 'approved' 
            THEN (end_date - start_date + 1)::numeric 
            END
          ), 2) as avg_leave_days,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
        FROM leave_requests
        WHERE group_admin_id = $1
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      )
      SELECT 
        total_requests,
        total_users,
        COALESCE(avg_leave_days, 0) as avg_leave_days,
        ROUND((approved_count::float / NULLIF(total_requests, 0) * 100)::numeric, 1) as approval_rate
      FROM monthly_stats
    `, [adminId]);
    console.log('Leave Metrics:', leaveMetrics.rows[0]);

    // Add to the existing response object
    const response = {
      expense: {
        total: expenseAnalytics.rows[0]?.total || 0,
        average: expenseAnalytics.rows[0]?.average || 0,
        currentMonthTotal: expenseAnalytics.rows[0]?.currentMonthTotal || 0,
        previousMonthTotal: expenseAnalytics.rows[0]?.previousMonthTotal || 0,
        lastUpdated: new Date().toISOString()
      },
      attendance: {
        total: attendanceAnalytics.rows[0]?.total || 0,
        average: attendanceAnalytics.rows[0]?.average || 0,
        trend: attendanceAnalytics.rows[0]?.trend || '0%',
        lastUpdated: new Date().toISOString()
      },
      task: {
        total_tasks: Number(taskMetrics.rows[0]?.total_tasks || 0),
        currentMonthTotal: Number(taskCurrentMonth.rows[0]?.count || 0),
        previousMonthTotal: Number(taskPreviousMonth.rows[0]?.count || 0),
        avg_completion_time: Number(taskMetrics.rows[0]?.avg_completion_time || 0),
        lastUpdated: new Date().toISOString()
      },
      travel: {
        total: Number(travelMetrics.rows[0]?.total_trips || 0),
        currentMonthTotal: Number(travelMetrics.rows[0]?.current_month_total || 0),
        previousMonthTotal: Number(travelMetrics.rows[0]?.previous_month_total || 0),
        average: Number(travelMetrics.rows[0]?.avg_trip_cost || 0).toFixed(2),
        lastUpdated: new Date().toISOString()
      },
      performance: {
        total: Number(performanceMetrics.rows[0]?.total_employees || 0),
        trend: `${performanceMetrics.rows[0]?.active_employees || 0}%`,
        average: Number(performanceMetrics.rows[0]?.avg_performance_score || 0).toFixed(2),
        lastUpdated: new Date().toISOString()
      },
      leave: {
        total: Number(leaveMetrics.rows[0]?.total_requests || 0),
        trend: `${leaveMetrics.rows[0]?.approval_rate || 0}%`,
        average: Number(leaveMetrics.rows[0]?.avg_leave_days || 0).toFixed(2),
        lastUpdated: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  } finally {
    client.release();
  }
});

// Add this endpoint to fetch attendance analytics
router.get('/attendance-analytics', 
  authMiddleware, 
  adminMiddleware, 
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      console.log('Attendance analytics requested by:', {
        userId: req.user?.id,
        role: req.user?.role
      });

      if (!req.user?.id) {
        return res.status(401).json({ 
          error: 'Authentication required'
        });
      }

      const { id: adminId } = req.user;
      
      // Extract filter parameters
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
      const department = req.query.department as string;
      
      // Format dates for consistent parameter handling
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Build parameters array
      const baseParams: Array<string | number> = [adminId, startDateStr, endDateStr];
      
      // Prepare filter conditions
      let employeeFilter = '';
      let departmentFilter = '';
      let paramIndex = 4;
      
      if (employeeId) {
        employeeFilter = ` AND user_id = $${paramIndex}`;
        baseParams.push(employeeId);
        paramIndex++;
      }
      
      if (department) {
        departmentFilter = ` AND u.department = $${paramIndex}`;
        baseParams.push(department);
      }
      
      // Debug query for employee check
      const employeeCheck = await client.query(`
        SELECT COUNT(*) as employee_count 
        FROM users 
        WHERE group_admin_id = $1`,
        [adminId]
      );
      
      console.log('Employee count:', employeeCheck.rows[0]?.employee_count);

      // Get daily attendance for bar chart
      const dailyQuery = `
        WITH days AS (
          SELECT generate_series(0, 6) as day
        ),
        shifts AS (
          SELECT 
            EXTRACT(DOW FROM start_time::date)::integer as shift_day,
            user_id,
            status,
            start_time
          FROM employee_shifts
          WHERE start_time >= $2::date
          AND start_time <= $3::date
          ${employeeId ? employeeFilter : ''}
        )
        SELECT 
          days.day,
          COALESCE(COUNT(DISTINCT s.user_id), 0) as attendance_count,
          COALESCE(COUNT(DISTINCT CASE 
            WHEN s.status = 'active' AND 
                 EXTRACT(HOUR FROM s.start_time) <= 9 
            THEN s.user_id 
          END), 0) as on_time_count
        FROM days
        LEFT JOIN shifts s ON days.day = s.shift_day
        LEFT JOIN users u ON s.user_id = u.id 
        WHERE u.group_admin_id = $1 OR u.id IS NULL
        ${department ? departmentFilter : ''}
        GROUP BY days.day
        ORDER BY days.day`;

      // Get weekly trend for line chart
      const weeklyQuery = `
        WITH filtered_shifts AS (
          SELECT 
            es.start_time,
            es.end_time,
            es.duration,
            es.user_id,
            es.status
          FROM employee_shifts es
          JOIN users u ON es.user_id = u.id
          WHERE u.group_admin_id = $1 
          AND es.start_time >= $2::date
          AND es.start_time <= $3::date
          ${employeeId ? employeeFilter : ''}
          ${department ? departmentFilter : ''}
        )
        SELECT 
          DATE_TRUNC('week', start_time)::date as week,
          COUNT(DISTINCT user_id) as attendance_count,
          COALESCE(AVG(
            CASE 
              WHEN duration IS NOT NULL THEN 
                EXTRACT(EPOCH FROM duration)/3600
              WHEN end_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (end_time - start_time))/3600
              ELSE NULL 
            END
          ), 0) as avg_hours
        FROM filtered_shifts
        GROUP BY DATE_TRUNC('week', start_time)::date
        ORDER BY week`;

      // Get heatmap data
      const heatmapQuery = `
        WITH filtered_shifts AS (
          SELECT 
            es.start_time,
            es.user_id
          FROM employee_shifts es
          JOIN users u ON es.user_id = u.id
          WHERE u.group_admin_id = $1 
          AND es.start_time >= $2::date
          AND es.start_time <= $3::date
          ${employeeId ? employeeFilter : ''}
          ${department ? departmentFilter : ''}
        )
        SELECT 
          start_time::date as date,
          COUNT(DISTINCT user_id) as count
        FROM filtered_shifts
        GROUP BY start_time::date
        ORDER BY date`;

      // Get overall metrics
      const metricsQuery = `
        WITH filtered_shifts AS (
          SELECT 
            es.user_id,
            es.status,
            es.duration,
            es.start_time,
            es.end_time,
            es.total_kilometers,
            es.total_expenses
          FROM employee_shifts es
          JOIN users u ON es.user_id = u.id
          WHERE u.group_admin_id = $1 
          AND es.start_time >= $2::date
          AND es.start_time <= $3::date
          ${employeeId ? employeeFilter : ''}
          ${department ? departmentFilter : ''}
        ),
        metrics AS (
          SELECT 
            COUNT(DISTINCT user_id) as total_employees,
            COALESCE(AVG(
              CASE 
                WHEN duration IS NOT NULL THEN 
                  EXTRACT(EPOCH FROM duration)/3600
                WHEN end_time IS NOT NULL THEN 
                  EXTRACT(EPOCH FROM (end_time - start_time))/3600
                ELSE NULL 
              END
            ), 0) as avg_hours,
            COUNT(DISTINCT CASE 
              WHEN status = 'active' AND 
                   EXTRACT(HOUR FROM start_time) <= 9 
              THEN user_id 
            END)::float / 
            NULLIF(COUNT(DISTINCT user_id), 0) * 100 as on_time_rate,
            SUM(total_kilometers) as total_distance,
            SUM(total_expenses) as total_expenses,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_shifts,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_shifts
          FROM filtered_shifts
        )
        SELECT 
          total_employees,
          ROUND(avg_hours::numeric, 2) as avg_hours,
          ROUND(on_time_rate::numeric, 2) as on_time_rate,
          ROUND(total_distance::numeric, 2) as total_distance,
          ROUND(total_expenses::numeric, 2) as total_expenses,
          active_shifts,
          completed_shifts
        FROM metrics`;

      // Get employees for filtering
      const employeesQuery = `
        SELECT id, name, employee_number, department
        FROM users
        WHERE group_admin_id = $1 AND role = 'employee'
        ORDER BY name ASC
      `;

      // Get departments for filtering
      const departmentsQuery = `
        SELECT DISTINCT department
        FROM users
        WHERE group_admin_id = $1 AND role = 'employee' AND department IS NOT NULL
        ORDER BY department
      `;

      // Get leave information
      const leaveQuery = `
        SELECT 
          u.id as employee_id,
          u.name as employee_name,
          u.employee_number,
          u.department,
          lr.start_date,
          lr.end_date,
          CASE 
            WHEN lr.days_requested > 0 THEN lr.days_requested
            WHEN lr.end_date >= lr.start_date THEN (lr.end_date - lr.start_date) + 1
            ELSE 0
          END as days_count,
          lt.name as leave_type,
          lt.is_paid
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE u.group_admin_id = $1
        AND lr.status = 'approved'
        AND (
          (lr.start_date >= $2::date AND lr.start_date <= $3::date)
          OR
          (lr.end_date >= $2::date AND lr.end_date <= $3::date)
          OR
          (lr.start_date <= $2::date AND lr.end_date >= $3::date)
        )
        ${employeeId ? employeeFilter.replace('user_id', 'lr.user_id') : ''}
        ${department ? departmentFilter : ''}
        ORDER BY lr.start_date
      `;

      // Get monthly attendance report
      const monthlyQuery = `
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', $2::date), 
            date_trunc('month', $3::date),
            '1 month'::interval
          ) AS month
        ),
        monthly_data AS (
          SELECT 
            DATE_TRUNC('month', es.start_time) as month,
            COUNT(DISTINCT es.user_id) as present_count,
            COUNT(DISTINCT DATE(es.start_time)) as working_days,
            ROUND(AVG(EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600)::numeric, 1) as avg_hours
          FROM employee_shifts es
          JOIN users u ON es.user_id = u.id
          WHERE u.group_admin_id = $1
          AND es.start_time >= $2::date
          AND es.start_time <= $3::date
          ${employeeId ? employeeFilter.replace('user_id', 'es.user_id') : ''}
          ${department ? departmentFilter : ''}
          GROUP BY DATE_TRUNC('month', es.start_time)
        )
        SELECT 
          TO_CHAR(m.month, 'Mon YYYY') as month_name,
          m.month as month_date,
          COALESCE(md.present_count, 0) as present_count,
          COALESCE(md.working_days, 0) as working_days,
          COALESCE(md.avg_hours, 0) as avg_hours
        FROM months m
        LEFT JOIN monthly_data md ON DATE_TRUNC('month', md.month) = m.month
        ORDER BY m.month
      `;

      // Get yearly attendance report
      const yearlyQuery = `
        WITH years AS (
          SELECT DISTINCT 
            EXTRACT(YEAR FROM generate_series(
              $2::date, 
              $3::date,
              '1 day'::interval
            )::date) as year
        ),
        yearly_data AS (
          SELECT 
            EXTRACT(YEAR FROM es.start_time) as year,
            COUNT(DISTINCT es.user_id) as total_employees,
            COUNT(DISTINCT DATE(es.start_time)) as working_days,
            ROUND(AVG(EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600)::numeric, 1) as avg_hours,
            ROUND(SUM(es.total_kilometers)::numeric, 1) as total_distance,
            ROUND(SUM(es.total_expenses)::numeric, 1) as total_expenses
          FROM employee_shifts es
          JOIN users u ON es.user_id = u.id
          WHERE u.group_admin_id = $1
          AND es.start_time >= $2::date
          AND es.start_time <= $3::date
          ${employeeId ? employeeFilter.replace('user_id', 'es.user_id') : ''}
          ${department ? departmentFilter : ''}
          GROUP BY EXTRACT(YEAR FROM es.start_time)
        )
        SELECT 
          y.year,
          COALESCE(yd.total_employees, 0) as total_employees,
          COALESCE(yd.working_days, 0) as working_days,
          COALESCE(yd.avg_hours, 0) as avg_hours,
          COALESCE(yd.total_distance, 0) as total_distance,
          COALESCE(yd.total_expenses, 0) as total_expenses
        FROM years y
        LEFT JOIN yearly_data yd ON yd.year = y.year
        ORDER BY y.year
      `;

      const [dailyResult, weeklyResult, monthlyResult, yearlyResult, heatmapResult, metricsResult, employeesResult, departmentsResult, leaveResult] = await Promise.all([
        client.query(dailyQuery, baseParams),
        client.query(weeklyQuery, baseParams),
        client.query(monthlyQuery, baseParams),
        client.query(yearlyQuery, baseParams),
        client.query(heatmapQuery, baseParams),
        client.query(metricsQuery, baseParams),
        client.query(employeesQuery, [adminId]),
        client.query(departmentsQuery, [adminId]),
        client.query(leaveQuery, baseParams)
      ]);

      // Log the results
      console.log('Query results:', {
        dailyCount: dailyResult.rows.length,
        weeklyCount: weeklyResult.rows.length,
        monthlyCount: monthlyResult.rows.length,
        yearlyCount: yearlyResult.rows.length,
        heatmapCount: heatmapResult.rows.length,
        hasMetrics: !!metricsResult.rows.length,
        leaveCount: leaveResult.rows.length
      });

      const response = {
        daily: dailyResult.rows.length ? dailyResult.rows : Array(7).fill({ 
          day: 0, 
          attendance_count: 0, 
          on_time_count: 0 
        }),
        weekly: weeklyResult.rows.length ? weeklyResult.rows : Array(4).fill({ 
          week: new Date(), 
          attendance_count: 0, 
          avg_hours: 0 
        }),
        monthly: monthlyResult.rows.length ? monthlyResult.rows : [],
        yearly: yearlyResult.rows.length ? yearlyResult.rows : [],
        heatmap: heatmapResult.rows.length ? heatmapResult.rows : [],
        metrics: metricsResult.rows[0] || {
          total_employees: 0,
          avg_hours: 0,
          on_time_rate: 0,
          total_distance: 0,
          total_expenses: 0,
          active_shifts: 0,
          completed_shifts: 0
        },
        employees: employeesResult.rows || [],
        departments: departmentsResult.rows.map(row => row.department) || [],
        leave: leaveResult.rows.map(row => ({
          employeeId: row.employee_id,
          employeeName: row.employee_name,
          employeeNumber: row.employee_number,
          department: row.department,
          startDate: new Date(row.start_date).toISOString(),
          endDate: new Date(row.end_date).toISOString(),
          daysCount: parseFloat(row.days_count || '0'),
          leaveType: row.leave_type,
          isPaid: row.is_paid
        }))
      };

      console.log('Sending response for attendance analytics');
      res.json(response);
  } catch (error) {
      console.error('Error in attendance analytics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch attendance analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  }
);

// Add this endpoint to fetch task analytics
router.get('/task-analytics', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;

    // Extract filter parameters
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    const department = req.query.department as string;

    // Format dates for consistent parameter handling
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Build parameters array and filter conditions
    const queryParams: Array<string | number> = [adminId, startDateStr, endDateStr];
    let employeeFilter = '';
    let departmentFilter = '';
    let paramIndex = 4; // Start from 4 since we have 3 parameters already

    if (employeeId) {
      employeeFilter = ` AND et.assigned_to = $${paramIndex}`;
      queryParams.push(employeeId);
      paramIndex++;
    }

    if (department) {
      departmentFilter = ` AND u.department = $${paramIndex}`;
      queryParams.push(department);
    }

    // Get task status distribution for pie chart
    const statusQuery = `
      SELECT 
        et.status,
        COUNT(*) as count
      FROM employee_tasks et
      JOIN users u ON et.assigned_to = u.id
      WHERE et.assigned_by = $1
      AND et.created_at >= $2::date
      AND et.created_at <= $3::date
      ${employeeFilter}
      ${departmentFilter}
      GROUP BY et.status
      ORDER BY count DESC`;

    // Get daily task creation trend for line chart
    const trendQuery = `
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', $2::date),
          date_trunc('day', $3::date),
          '1 day'::interval
        ) as day
      )
      SELECT 
        days.day::date as date,
        COALESCE(COUNT(et.id), 0) as task_count
      FROM days
      LEFT JOIN employee_tasks et ON 
        date_trunc('day', et.created_at) = days.day
        AND et.assigned_by = $1
      LEFT JOIN users u ON et.assigned_to = u.id
      WHERE (et.id IS NULL OR (et.assigned_by = $1 
        ${employeeFilter}
        ${departmentFilter}))
      GROUP BY days.day
      ORDER BY days.day`;

    // Get task priority distribution for bar chart
    const priorityQuery = `
      SELECT 
        et.priority,
        COUNT(*) as count
      FROM employee_tasks et
      JOIN users u ON et.assigned_to = u.id
      WHERE et.assigned_by = $1
      AND et.created_at >= $2::date
      AND et.created_at <= $3::date
      ${employeeFilter}
      ${departmentFilter}
      GROUP BY et.priority
      ORDER BY 
        CASE et.priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END`;

    // Get overall metrics
    const metricsQuery = `
      WITH task_metrics AS (
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(DISTINCT et.assigned_to) as assigned_employees,
          COUNT(CASE WHEN et.status = 'completed' THEN 1 END)::float / 
            NULLIF(COUNT(*), 0) * 100 as completion_rate,
          COUNT(CASE WHEN et.due_date < CURRENT_TIMESTAMP 
                     AND et.status != 'completed' 
                  THEN 1 END) as overdue_tasks,
          (COUNT(*)::decimal / 30.0) as avg_tasks_per_day
        FROM employee_tasks et
        JOIN users u ON et.assigned_to = u.id
        WHERE et.assigned_by = $1
        AND et.created_at >= $2::date
        AND et.created_at <= $3::date
        ${employeeFilter}
        ${departmentFilter}
      )
      SELECT 
        total_tasks,
        assigned_employees,
        ROUND(completion_rate::numeric, 1) as completion_rate,
        overdue_tasks,
        ROUND(avg_tasks_per_day::numeric, 2) as avg_completion_time
      FROM task_metrics
    `;

    // Get employees for filtering
    const employeesQuery = `
      SELECT id, name, employee_number, department
      FROM users
      WHERE group_admin_id = $1 AND role = 'employee'
      ORDER BY name ASC
    `;

    // Get departments for filtering
    const departmentsQuery = `
      SELECT DISTINCT department
      FROM users
      WHERE group_admin_id = $1 AND role = 'employee' AND department IS NOT NULL
      ORDER BY department
    `;

    const [statusResult, trendResult, priorityResult, metricsResult, employeesResult, departmentsResult] = await Promise.all([
      client.query(statusQuery, queryParams),
      client.query(trendQuery, queryParams),
      client.query(priorityQuery, queryParams),
      client.query(metricsQuery, queryParams),
      client.query(employeesQuery, [adminId]),
      client.query(departmentsQuery, [adminId])
    ]);

    // Process and format the response
    const response = {
      status: statusResult.rows,
      trend: trendResult.rows,
      priority: priorityResult.rows,
      metrics: {
        total_tasks: Number(metricsResult.rows[0]?.total_tasks || 0),
        assigned_employees: Number(metricsResult.rows[0]?.assigned_employees || 0),
        completion_rate: Number(metricsResult.rows[0]?.completion_rate || 0).toFixed(1),
        overdue_tasks: Number(metricsResult.rows[0]?.overdue_tasks || 0),
        avg_completion_time: Number(metricsResult.rows[0]?.avg_completion_time || 0).toFixed(1)
      },
      employees: employeesResult.rows || [],
      departments: departmentsResult.rows.map(row => row.department) || []
    };

    // After executing the query, add debug logging
    console.log('Task Analytics Metrics:', metricsResult.rows[0]);

    res.json(response);
  } catch (error) {
    console.error('Error in task analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch task analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Add this endpoint to fetch travel analytics
router.get('/travel-analytics', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;

    // Extract filter parameters
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    const department = req.query.department as string;

    // Format dates for consistent parameter handling
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Build parameters array and filter conditions
    const queryParams: Array<string | number> = [adminId, startDateStr, endDateStr];
    let employeeFilter = '';
    let departmentFilter = '';
    let paramIndex = 4; // Start from 4 since we have 3 parameters already

    if (employeeId) {
      employeeFilter = ` AND e.user_id = $${paramIndex}`;
      queryParams.push(employeeId);
      paramIndex++;
    }

    if (department) {
      departmentFilter = ` AND u.department = $${paramIndex}`;
      queryParams.push(department);
    }

    // Get expense distribution by category
    const expenseQuery = `
      WITH expense_categories AS (
        SELECT 
          'Lodging' as category, lodging_expenses as amount
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE e.group_admin_id = $1 
        AND e.created_at >= $2::date
        AND e.created_at <= $3::date
        ${employeeFilter}
        ${departmentFilter}
        UNION ALL
        SELECT 
          'Daily Allowance', daily_allowance
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE e.group_admin_id = $1 
        AND e.created_at >= $2::date
        AND e.created_at <= $3::date
        ${employeeFilter}
        ${departmentFilter}
        UNION ALL
        SELECT 
          'Fuel', diesel
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE e.group_admin_id = $1 
        AND e.created_at >= $2::date
        AND e.created_at <= $3::date
        ${employeeFilter}
        ${departmentFilter}
        UNION ALL
        SELECT 
          'Toll', toll_charges
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE e.group_admin_id = $1 
        AND e.created_at >= $2::date
        AND e.created_at <= $3::date
        ${employeeFilter}
        ${departmentFilter}
        UNION ALL
        SELECT 
          'Other', other_expenses
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE e.group_admin_id = $1 
        AND e.created_at >= $2::date
        AND e.created_at <= $3::date
        ${employeeFilter}
        ${departmentFilter}
      )
      SELECT 
        category,
        ROUND(SUM(amount)::numeric, 2) as total_amount,
        ROUND((SUM(amount) * 100.0 / NULLIF(SUM(SUM(amount)) OVER (), 0))::numeric, 1) as percentage
      FROM expense_categories
      WHERE amount > 0
      GROUP BY category
      ORDER BY total_amount DESC`;

    // Get top locations by expense amount
    const locationQuery = `
      SELECT 
        location,
        COUNT(*) as trip_count,
        ROUND(SUM(total_amount)::numeric, 2) as total_amount
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1 
      AND e.created_at >= $2::date
      AND e.created_at <= $3::date
      ${employeeFilter}
      ${departmentFilter}
      AND location IS NOT NULL
      GROUP BY location
      ORDER BY total_amount DESC
      LIMIT 5`;

    // Get transport type distribution
    const transportQuery = `
      SELECT 
        e.vehicle_type,
        COUNT(*) as trip_count,
        ROUND(SUM(e.total_kilometers)::numeric, 2) as total_distance,
        ROUND(SUM(e.total_amount)::numeric, 2) as total_amount
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1 
      AND e.created_at >= $2::date
      AND e.created_at <= $3::date
      ${employeeFilter}
      ${departmentFilter}
      AND e.vehicle_type IS NOT NULL
      GROUP BY e.vehicle_type
      ORDER BY total_amount DESC`;

    // Get overall metrics
    const metricsQuery = `
      SELECT 
        COUNT(DISTINCT e.user_id) as total_travelers,
        COUNT(*) as total_trips,
        ROUND(SUM(total_kilometers)::numeric, 2) as total_distance,
        ROUND(SUM(total_amount)::numeric, 2) as total_expenses,
        ROUND(AVG(total_amount)::numeric, 2) as avg_trip_cost
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1
      AND e.created_at >= $2::date
      AND e.created_at <= $3::date
      ${employeeFilter}
      ${departmentFilter}`;

    // Get employees for filtering
    const employeesQuery = `
      SELECT id, name, employee_number, department
      FROM users
      WHERE group_admin_id = $1 AND role = 'employee'
      ORDER BY name ASC
    `;

    // Get departments for filtering
    const departmentsQuery = `
      SELECT DISTINCT department
      FROM users
      WHERE group_admin_id = $1 AND role = 'employee' AND department IS NOT NULL
      ORDER BY department
    `;

    const [expenseResult, locationResult, transportResult, metricsResult, employeesResult, departmentsResult] = await Promise.all([
      client.query(expenseQuery, queryParams),
      client.query(locationQuery, queryParams),
      client.query(transportQuery, queryParams),
      client.query(metricsQuery, queryParams),
      client.query(employeesQuery, [adminId]),
      client.query(departmentsQuery, [adminId])
    ]);

    // Process and format the response
    const response = {
      expenses: expenseResult.rows.map(row => ({
        ...row,
        color: getCategoryColor(row.category)
      })),
      locations: locationResult.rows,
      transport: transportResult.rows,
      metrics: {
        total_travelers: Number(metricsResult.rows[0]?.total_travelers || 0),
        total_trips: Number(metricsResult.rows[0]?.total_trips || 0),
        total_distance: Number(metricsResult.rows[0]?.total_distance || 0),
        total_expenses: Number(metricsResult.rows[0]?.total_expenses || 0),
        avg_trip_cost: Number(metricsResult.rows[0]?.avg_trip_cost || 0)
      },
      employees: employeesResult.rows || [],
      departments: departmentsResult.rows.map(row => row.department) || []
    };

    res.json(response);
  } catch (error) {
    console.error('Error in travel analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch travel analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Add this endpoint to fetch performance analytics
router.get('/performance-analytics', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;

    // Get attendance performance - Updated query
    const attendanceQuery = `
      WITH employee_list AS (
        SELECT id, name 
        FROM users 
        WHERE group_admin_id = $1 AND role = 'employee'
      ),
      employee_attendance AS (
        SELECT 
          u.id as employee_id,
          u.name as employee_name,
          COUNT(DISTINCT DATE(es.start_time)) as days_present,
          COUNT(DISTINCT CASE 
            WHEN EXTRACT(HOUR FROM es.start_time) <= 9 THEN DATE(es.start_time)
          END) as on_time_days,
          COUNT(DISTINCT CASE 
            WHEN es.status = 'completed' THEN DATE(es.start_time)
          END) as completed_shifts
        FROM employee_list u
        LEFT JOIN employee_shifts es ON es.user_id = u.id
          AND es.start_time >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY u.id, u.name
      )
      SELECT 
        employee_id,
        employee_name,
        days_present,
        ROUND((on_time_days::float / NULLIF(days_present, 0) * 100)::numeric, 1) as punctuality_rate,
        ROUND((completed_shifts::float / NULLIF(days_present, 0) * 100)::numeric, 1) as completion_rate
      FROM employee_attendance
      ORDER BY days_present DESC, punctuality_rate DESC`;

    // Get task performance - Updated query
    const taskQuery = `
      WITH employee_list AS (
        SELECT id, name 
        FROM users 
        WHERE group_admin_id = $1 AND role = 'employee'
      )
      SELECT 
        u.id as employee_id,
        u.name as employee_name,
        COUNT(et.*) as total_tasks,
        COUNT(CASE WHEN et.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN et.status = 'completed' AND et.due_date >= et.last_status_update THEN 1 END) as on_time_completion,
        ROUND(AVG(
          CASE WHEN et.status = 'completed' 
          THEN EXTRACT(EPOCH FROM (et.last_status_update - et.created_at))/3600 
          END
        )::numeric, 1) as avg_completion_time
      FROM employee_list u
      LEFT JOIN employee_tasks et ON et.assigned_to = u.id
        AND et.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY u.id, u.name
      ORDER BY total_tasks DESC`;

    // Get expense compliance - Updated query
    const expenseQuery = `
      WITH employee_list AS (
        SELECT id, name 
        FROM users 
        WHERE group_admin_id = $1 AND role = 'employee'
      )
      SELECT 
        u.id as employee_id,
        u.name as employee_name,
        COUNT(e.*) as total_expenses,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as approved_expenses,
        ROUND(AVG(e.total_amount)::numeric, 2) as avg_expense_amount,
        COUNT(CASE WHEN e.status = 'rejected' THEN 1 END) as rejected_expenses
      FROM employee_list u
      LEFT JOIN expenses e ON e.user_id = u.id
        AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY u.id, u.name
      ORDER BY total_expenses DESC`;

    // Get overall metrics - Updated query
    const metricsQuery = `
      WITH employee_metrics AS (
        SELECT 
          COUNT(DISTINCT u.id) as total_employees,
          COUNT(DISTINCT es.user_id) as active_employees,
          AVG(
            CASE WHEN es.status = 'completed' 
            THEN EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600 
            END
          ) as avg_working_hours
        FROM users u
        LEFT JOIN employee_shifts es ON es.user_id = u.id
          AND es.created_at >= CURRENT_DATE - INTERVAL '30 days'
        WHERE u.group_admin_id = $1 AND u.role = 'employee'
      ),
      task_metrics AS (
        SELECT 
          ROUND(
            (COUNT(CASE WHEN et.status = 'completed' THEN 1 END)::float * 100 / 
            NULLIF(COUNT(*), 0))::numeric, 
            1
          ) as task_completion_rate
        FROM employee_tasks et
        WHERE et.assigned_by = $1
          AND et.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ),
      expense_metrics AS (
        SELECT 
          ROUND(
            (COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::float * 100 / 
            NULLIF(COUNT(*), 0))::numeric, 
            1
          ) as expense_approval_rate
        FROM expenses e
        WHERE e.group_admin_id = $1
          AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT 
        em.total_employees,
        ROUND(em.avg_working_hours::numeric, 1) as avg_working_hours,
        COALESCE(tm.task_completion_rate, 0) as task_completion_rate,
        COALESCE(ex.expense_approval_rate, 0) as expense_approval_rate
      FROM employee_metrics em
      CROSS JOIN task_metrics tm
      CROSS JOIN expense_metrics ex`;

    const [attendanceResult, taskResult, expenseResult, metricsResult] = await Promise.all([
      client.query(attendanceQuery, [adminId]),
      client.query(taskQuery, [adminId]),
      client.query(expenseQuery, [adminId]),
      client.query(metricsQuery, [adminId])
    ]);

    // Process and format the response
    const response = {
      attendance: attendanceResult.rows,
      tasks: taskResult.rows,
      expenses: expenseResult.rows,
      metrics: {
        total_employees: Number(metricsResult.rows[0]?.total_employees || 0),
        avg_working_hours: Number(metricsResult.rows[0]?.avg_working_hours || 0),
        task_completion_rate: Number(metricsResult.rows[0]?.task_completion_rate || 0),
        expense_approval_rate: Number(metricsResult.rows[0]?.expense_approval_rate || 0)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error in performance analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch performance analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Add this endpoint to fetch leave analytics
router.get('/leave-analytics', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;

    // Get leave type distribution
    const leaveTypeQuery = `
      SELECT 
        lt.name as leave_type,
        lt.id as leave_type_id,
        lp.default_days,
        lp.max_consecutive_days,
        COUNT(*) as request_count,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_count,
        SUM(CASE 
          WHEN lr.days_requested > 0 THEN lr.days_requested
          WHEN lr.end_date >= lr.start_date THEN (lr.end_date - lr.start_date) + 1
          ELSE 0
        END) as total_days
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
      JOIN users u ON lr.user_id = u.id
      WHERE u.group_admin_id = $1
      AND lr.created_at >= CURRENT_DATE - INTERVAL '180 days'
      GROUP BY lt.id, lt.name, lp.default_days, lp.max_consecutive_days
      ORDER BY request_count DESC`;

    // Get employee leave stats
    const employeeStatsQuery = `
      WITH employee_list AS (
        SELECT id, name 
        FROM users 
        WHERE group_admin_id = $1 AND role = 'employee'
      ),
      employee_leaves AS (
        SELECT 
          u.id as employee_id,
          u.name as employee_name,
          COUNT(lr.id) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
          SUM(CASE 
            WHEN lr.days_requested > 0 THEN lr.days_requested
            WHEN lr.end_date >= lr.start_date THEN (lr.end_date - lr.start_date) + 1
            ELSE 0
          END) as total_leave_days,
          STRING_AGG(DISTINCT lt.name, ', ') as leave_types
        FROM employee_list el
        LEFT JOIN leave_requests lr ON el.id = lr.user_id
        LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN users u ON el.id = u.id
        WHERE lr.id IS NOT NULL
        GROUP BY u.id, u.name
        ORDER BY total_requests DESC
        LIMIT 10
      )
      SELECT * FROM employee_leaves`;

    // Get leave balances
    const balancesQuery = `
      WITH employee_count AS (
        SELECT COUNT(*) as count FROM users WHERE group_admin_id = $1 AND role = 'employee'
      ),
      leave_type_balances AS (
        SELECT 
          lt.id,
          lt.name,
          SUM(lb.total_days) as total_available,
          SUM(lb.used_days) as total_used,
          SUM(lb.pending_days) as total_pending
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        JOIN users u ON lb.user_id = u.id
        WHERE u.group_admin_id = $1
        AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
        GROUP BY lt.id, lt.name
      )
      SELECT 
        (SELECT SUM(total_available) FROM leave_type_balances) as total_available,
        (SELECT SUM(total_used) FROM leave_type_balances) as total_used,
        (SELECT SUM(total_pending) FROM leave_type_balances) as total_pending,
        (SELECT count FROM employee_count) as employee_count,
        json_agg(
          json_build_object(
            'leave_type', lt.name,
            'total_available', total_available,
            'total_used', total_used,
            'total_pending', total_pending
          )
        ) as leave_types_balances
      FROM leave_type_balances lt`;

    // Get monthly trend
    const trendQuery = `
      SELECT 
        TO_CHAR(lr.start_date, 'YYYY-MM-DD') as date,
        COUNT(*) as request_count,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
        SUM(CASE 
          WHEN lr.days_requested > 0 THEN lr.days_requested
          WHEN lr.end_date >= lr.start_date THEN (lr.end_date - lr.start_date) + 1
          ELSE 0
        END) as total_days
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE u.group_admin_id = $1
      AND lr.start_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC`;

    // Get overall metrics
    const metricsQuery = `
      WITH leave_stats AS (
        SELECT 
          COUNT(DISTINCT lr.user_id) as total_employees_on_leave,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
          COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_requests,
          CASE 
            WHEN COUNT(*) > 0 THEN 
              ROUND((COUNT(CASE WHEN lr.status = 'approved' THEN 1 END)::float / 
                    COUNT(*)::float) * 100)
            ELSE 0
          END as approval_rate,
          SUM(CASE 
            WHEN lr.days_requested > 0 THEN lr.days_requested
            WHEN lr.end_date >= lr.start_date THEN (lr.end_date - lr.start_date) + 1
            ELSE 0
          END) as total_leave_days
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        WHERE u.group_admin_id = $1
        AND lr.created_at >= CURRENT_DATE - INTERVAL '90 days'
      )
      SELECT * FROM leave_stats`;

    // Execute all queries
    const [leaveTypeResults, employeeStatsResults, balancesResults, trendResults, metricsResults] = await Promise.all([
      client.query(leaveTypeQuery, [adminId]),
      client.query(employeeStatsQuery, [adminId]),
      client.query(balancesQuery, [adminId]),
      client.query(trendQuery, [adminId]),
      client.query(metricsQuery, [adminId])
    ]);

    // Format response
    const response = {
      leaveTypes: leaveTypeResults.rows,
      employeeStats: employeeStatsResults.rows,
      balances: {
        ...balancesResults.rows[0],
        casual_leave: 0,  // Keeping for backward compatibility
        sick_leave: 0,    // Keeping for backward compatibility
        annual_leave: 0   // Keeping for backward compatibility
      },
      trend: trendResults.rows,
      metrics: metricsResults.rows[0] || {
        total_employees_on_leave: 0,
        total_requests: 0,
        approved_requests: 0,
        pending_requests: 0,
        approval_rate: 0,
        total_leave_days: 0
      }
    };

    // Extract common leave types for backward compatibility
    if (balancesResults.rows[0]?.leave_types_balances) {
      balancesResults.rows[0].leave_types_balances.forEach((ltb: any) => {
        const type = ltb.leave_type.toLowerCase();
        if (type.includes('casual') || type.includes('cl')) {
          response.balances.casual_leave = ltb.total_available || 0;
        }
        if (type.includes('sick') || type.includes('sl')) {
          response.balances.sick_leave = ltb.total_available || 0;
        }
        if (type.includes('annual') || type.includes('privilege') || 
            type.includes('pl') || type.includes('el')) {
          response.balances.annual_leave = ltb.total_available || 0;
        }
      });
    }

    return res.json(response);
  } catch (error) {
    console.error('Error fetching leave analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch leave analytics' });
  } finally {
    client.release();
  }
});

// Helper function to get category colors
function getCategoryColor(category: string): string {
  const colors: { [key: string]: string } = {
    'Lodging': '#3B82F6',     // Blue
    'Daily Allowance': '#10B981', // Green
    'Fuel': '#F59E0B',        // Yellow
    'Toll': '#8B5CF6',        // Purple
    'Other': '#6B7280'        // Gray
  };
  return colors[category] || colors['Other'];
}

export default router; 