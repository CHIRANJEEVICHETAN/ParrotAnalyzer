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

    // Monthly data query with error handling
    let monthlyData;
    try {
      monthlyData = await client.query(`
        SELECT 
          TO_CHAR(date, 'Mon') as month,
          COALESCE(SUM(total_amount), 0) as amount
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(date, 'Mon')
        ORDER BY MIN(date)
      `, [adminId]);
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
        AND date >= NOW() - INTERVAL '6 months'
        AND lodging_expenses > 0
        
        UNION ALL
        
        SELECT 
          'Daily Allowance' as name,
          COALESCE(SUM(daily_allowance), 0) as population
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= NOW() - INTERVAL '6 months'
        AND daily_allowance > 0
        
        UNION ALL
        
        SELECT 
          'Fuel' as name,
          COALESCE(SUM(diesel), 0) as population
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= NOW() - INTERVAL '6 months'
        AND diesel > 0
        
        UNION ALL
        
        SELECT 
          'Toll' as name,
          COALESCE(SUM(toll_charges), 0) as population
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= NOW() - INTERVAL '6 months'
        AND toll_charges > 0
        
        UNION ALL
        
        SELECT 
          'Other' as name,
          COALESCE(SUM(other_expenses), 0) as population
        FROM expenses 
        WHERE group_admin_id = $1
        AND date >= NOW() - INTERVAL '6 months'
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
    `, [adminId]);

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
        AND date >= NOW() - INTERVAL '6 months'
      `, [adminId]);
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

    // First get all employees under this admin
    const employees = await client.query(`
      SELECT id, name, employee_number, department
      FROM users 
      WHERE group_admin_id = $1 AND role = 'employee'
      ORDER BY name ASC`,
      [req.user.id]
    );

    // Get expense stats for selected employee or all employees
    const employeeId = req.query.employeeId;
    const employeeFilter = employeeId ? 'AND user_id = $2' : '';
    const queryParams = employeeId ? [req.user.id, employeeId] : [req.user.id];

    const expenseStats = await client.query(`
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
      WHERE e.group_admin_id = $1 ${employeeFilter}
      AND e.date >= NOW() - INTERVAL '6 months'
      GROUP BY u.id, u.name, u.employee_number, DATE_TRUNC('month', e.date)
      ORDER BY DATE_TRUNC('month', e.date) ASC`,
      queryParams
    );

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
router.get('/analytics', verifyToken, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

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
        [req.user.id]
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
        SELECT 
          COALESCE(COUNT(*), 0) as total,
          COALESCE(COUNT(*), 0) as average,
          '0%' as trend
        FROM users 
        WHERE group_admin_id = $1 
        AND role = 'employee'`,
        [req.user.id]
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

    // Return the response with default values if needed
    res.json({
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
      }
    });

  } catch (error) {
    console.error('Detailed error in analytics:', error);
    // Return a default response instead of error
    res.json({
      expense: {
        total: 0,
        average: 0,
        currentMonthTotal: 0,
        previousMonthTotal: 0,
        lastUpdated: new Date().toISOString()
      },
      attendance: {
        total: 0,
        average: 0,
        trend: '0%',
        lastUpdated: new Date().toISOString()
      }
    });
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