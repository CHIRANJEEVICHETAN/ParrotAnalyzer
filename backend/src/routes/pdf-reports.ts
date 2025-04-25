import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { PoolClient } from 'pg';

const router = express.Router();

// Add this function at the top with other imports
async function getCompanyDetails(client: PoolClient, userId: string) {
  const result = await client.query(`
    SELECT 
      c.name,
      encode(c.logo, 'base64') as logo_base64,
      c.address,
      c.phone
    FROM companies c
    JOIN users u ON u.company_id = c.id
    WHERE u.id = $1
    AND c.status = 'active'`,
    [userId]
  );

  if (!result.rows[0]) {
    throw new Error('Company details not found');
  }

  return {
    name: result.rows[0].name,
    // Convert bytea to data URL for images
    logo: result.rows[0].logo_base64 
      ? `data:image/png;base64,${result.rows[0].logo_base64}`
      : null,
    address: result.rows[0].address,
    contact: result.rows[0].phone // Use phone column directly
  };
}

// Get PDF data for specific report type
router.get('/:type', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { type } = req.params;
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const adminId = req.user.id;
    
    // Get admin details
    const adminResult = await client.query(`
      SELECT name as admin_name
      FROM users
      WHERE id = $1
    `, [adminId]);
    
    const adminName = adminResult.rows[0]?.admin_name || 'Group Admin';
    
    // Get company details
    const companyInfo = await getCompanyDetails(client, adminId.toString());

    let data;
    switch (type) {
      case 'expense':
        data = await getExpenseReportData(client, adminId.toString());
        break;
      case 'attendance':
        data = await getAttendanceReportData(client, adminId.toString());
        break;
      case 'task':
        data = await getTaskReportData(client, adminId.toString());
        break;
      case 'travel':
        data = await getTravelReportData(client, adminId.toString());
        break;
      case 'performance':
        data = await getPerformanceReportData(client, adminId.toString());
        break;
      case 'leave':
        data = await getLeaveReportData(client, adminId.toString());
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    // Add both company info and admin name to the response
    res.json({
      ...data,
      companyInfo,
      adminName
    });
  } catch (error) {
    console.error('Error fetching PDF report data:', error);
    res.status(500).json({ error: 'Failed to fetch report data' });
  } finally {
    client.release();
  }
});

async function getExpenseReportData(client: PoolClient, adminId: string) {
  // Get summary data
  const summaryResult = await client.query(`
    SELECT 
      COUNT(*) as total_claims,
      SUM(total_amount) as total_expenses,
      AVG(total_amount) as average_expense,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      ROUND(
        (COUNT(CASE WHEN status = 'approved' THEN 1 END)::float * 100 / 
        NULLIF(COUNT(*), 0))::numeric,
        1
      ) as approval_rate
    FROM expenses
    WHERE group_admin_id = $1
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
    [adminId]
  );

  // Fixed category breakdown query
  const categoryResult = await client.query(`
    SELECT 
      category,
      SUM(amount) as amount
    FROM (
      SELECT 'Lodging' as category, lodging_expenses as amount
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND lodging_expenses > 0
      
      UNION ALL
      
      SELECT 'Daily Allowance', daily_allowance
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND daily_allowance > 0
      
      UNION ALL
      
      SELECT 'Fuel', diesel
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND diesel > 0
      
      UNION ALL
      
      SELECT 'Toll', toll_charges
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND toll_charges > 0
      
      UNION ALL
      
      SELECT 'Other', other_expenses
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND other_expenses > 0
    ) as expense_categories
    GROUP BY category
    ORDER BY amount DESC`,
    [adminId]
  );

  // Get recent expenses
  const recentExpenses = await client.query(`
    SELECT 
      u.name as employee_name,
      e.date,
      e.total_amount as amount,
      e.status,
      CASE 
        WHEN e.lodging_expenses > 0 THEN 'Lodging'
        WHEN e.daily_allowance > 0 THEN 'Daily Allowance'
        WHEN e.diesel > 0 THEN 'Fuel'
        WHEN e.toll_charges > 0 THEN 'Toll'
        ELSE 'Other'
      END as category,
      e.comments
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.group_admin_id = $1
    ORDER BY e.date DESC`,
    [adminId]
  );

  // Calculate total for percentages
  const total = categoryResult.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);

  return {
    summary: {
      totalExpenses: parseFloat(summaryResult.rows[0].total_expenses) || 0,
      averageExpense: parseFloat(summaryResult.rows[0].average_expense) || 0,
      approvalRate: parseFloat(summaryResult.rows[0].approval_rate) || 0,
      pendingCount: parseInt(summaryResult.rows[0].pending_count) || 0
    },
    categoryBreakdown: categoryResult.rows.map(row => ({
      category: row.category,
      amount: parseFloat(row.amount),
      percentage: ((parseFloat(row.amount) / total) * 100).toFixed(1)
    })),
    recentExpenses: recentExpenses.rows.map(row => ({
      employeeName: row.employee_name,
      date: new Date(row.date).toLocaleDateString(),
      amount: parseFloat(row.amount || '0'),
      status: row.status,
      category: row.category,
      description: row.comments || ''
    }))
  };
}

async function getAttendanceReportData(client: PoolClient, adminId: string) {
  // Get summary data
  const summaryResult = await client.query(`
    WITH employee_stats AS (
      SELECT 
        COUNT(DISTINCT es.user_id) as total_employees,
        AVG(EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600) as avg_hours,
        SUM(e.total_kilometers) as total_distance,
        COUNT(CASE 
          WHEN EXTRACT(HOUR FROM es.start_time) <= 9 THEN 1 
        END)::float / NULLIF(COUNT(*), 0) * 100 as on_time_rate
      FROM employee_shifts es
      JOIN users u ON es.user_id = u.id
      LEFT JOIN expenses e ON e.user_id = es.user_id 
        AND DATE(e.date) = DATE(es.start_time)
      WHERE u.group_admin_id = $1
      AND DATE(es.start_time) >= CURRENT_DATE - INTERVAL '30 days'
    )
    SELECT 
      total_employees,
      ROUND(avg_hours::numeric, 1) as avg_working_hours,
      ROUND(on_time_rate::numeric, 1) as on_time_rate,
      ROUND(total_distance::numeric, 1) as total_distance
    FROM employee_stats`,
    [adminId]
  );

  // Get daily statistics
  const dailyStatsResult = await client.query(`
    SELECT 
      DATE(es.start_time) as date,
      COUNT(DISTINCT es.user_id) as present_count,
      COUNT(CASE 
        WHEN EXTRACT(HOUR FROM es.start_time) <= 9 THEN 1 
      END) as on_time_count,
      ROUND(AVG(EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600)::numeric, 1) as total_hours,
      COALESCE(SUM(e.total_kilometers), 0) as total_distance
    FROM employee_shifts es
    JOIN users u ON es.user_id = u.id
    LEFT JOIN expenses e ON e.user_id = es.user_id 
      AND DATE(e.date) = DATE(es.start_time)
    WHERE u.group_admin_id = $1
    AND DATE(es.start_time) >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(es.start_time)
    ORDER BY date DESC`,
    [adminId]
  );

  // Get employee statistics
  const employeeStatsResult = await client.query(`
    SELECT 
      u.name as employee_name,
      COUNT(DISTINCT DATE(es.start_time)) as days_present,
      ROUND(AVG(EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600)::numeric, 1) as avg_hours,
      ROUND((COUNT(CASE 
        WHEN EXTRACT(HOUR FROM es.start_time) <= 9 THEN 1 
      END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 1) as on_time_percentage,
      COALESCE(SUM(e.total_kilometers), 0) as total_distance,
      COALESCE(SUM(e.total_amount), 0) as total_expenses
    FROM users u
    LEFT JOIN employee_shifts es ON u.id = es.user_id
      AND DATE(es.start_time) >= CURRENT_DATE - INTERVAL '30 days'
    LEFT JOIN expenses e ON e.user_id = u.id 
      AND DATE(e.date) = DATE(es.start_time)
    WHERE u.group_admin_id = $1
    AND u.role = 'employee'
    GROUP BY u.id, u.name
    ORDER BY days_present DESC`,
    [adminId]
  );

  return {
    summary: {
      totalEmployees: parseInt(summaryResult.rows[0]?.total_employees || '0'),
      avgWorkingHours: parseFloat(summaryResult.rows[0]?.avg_working_hours || '0'),
      onTimeRate: parseFloat(summaryResult.rows[0]?.on_time_rate || '0'),
      totalDistance: parseFloat(summaryResult.rows[0]?.total_distance || '0')
    },
    dailyStats: dailyStatsResult.rows.map(row => ({
      date: new Date(row.date).toLocaleDateString(),
      presentCount: parseInt(row.present_count || '0'),
      onTimeCount: parseInt(row.on_time_count || '0'),
      totalHours: parseFloat(row.total_hours || '0'),
      totalDistance: parseFloat(row.total_distance || '0')
    })),
    employeeStats: employeeStatsResult.rows.map(row => ({
      employeeName: row.employee_name,
      daysPresent: parseInt(row.days_present || '0'),
      avgHours: parseFloat(row.avg_hours || '0'),
      onTimePercentage: parseFloat(row.on_time_percentage || '0'),
      totalDistance: parseFloat(row.total_distance || '0'),
      totalExpenses: parseFloat(row.total_expenses || '0')
    }))
  };
}

async function getTaskReportData(client: PoolClient, adminId: string) {
  // Get company details first
  const companyResult = await client.query(`
    SELECT 
      c.name,
      encode(c.logo, 'base64') as logo,
      c.address,
      c.phone as contact
    FROM companies c
    JOIN users u ON u.company_id = c.id
    WHERE u.id = $1`,
    [adminId]
  );

  const companyInfo = companyResult.rows[0] || {
    name: '',
    logo: '',
    address: '',
    contact: ''
  };

  // Get summary data
  const summaryResult = await client.query(`
    WITH task_stats AS (
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN due_date < CURRENT_DATE AND status != 'completed' THEN 1 END) as overdue_tasks,
        AVG(EXTRACT(EPOCH FROM (
          CASE WHEN status = 'completed' 
          THEN updated_at - created_at 
          END
        ))/3600) as avg_completion_time
      FROM employee_tasks
      WHERE assigned_by = $1
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    )
    SELECT 
      total_tasks,
      completed_tasks,
      overdue_tasks,
      ROUND(avg_completion_time::numeric, 1) as avg_completion_time,
      ROUND((completed_tasks::float * 100 / NULLIF(total_tasks, 0))::numeric, 1) as completion_rate
    FROM task_stats`,
    [adminId]
  );

  // Get status breakdown
  const statusResult = await client.query(`
    SELECT 
      status,
      COUNT(*) as count
    FROM employee_tasks
    WHERE assigned_by = $1
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY status`,
    [adminId]
  );

  // Get priority breakdown
  const priorityResult = await client.query(`
    SELECT 
      priority,
      COUNT(*) as count
    FROM employee_tasks
    WHERE assigned_by = $1
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY priority`,
    [adminId]
  );

  // Get employee performance
  const employeeResult = await client.query(`
    SELECT 
      u.name as employee_name,
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
      ROUND((COUNT(CASE WHEN t.status = 'completed' AND t.updated_at <= t.due_date THEN 1 END)::float * 100 / 
        NULLIF(COUNT(CASE WHEN t.status = 'completed' THEN 1 END), 0))::numeric, 1) as on_time_completion,
      ROUND(AVG(EXTRACT(EPOCH FROM (
        CASE WHEN t.status = 'completed' 
        THEN t.updated_at - t.created_at 
        END
      ))/3600)::numeric, 1) as avg_completion_time
    FROM employee_tasks t
    JOIN users u ON t.assigned_to = u.id
    WHERE t.assigned_by = $1
    AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY u.id, u.name
    ORDER BY total_tasks DESC`,
    [adminId]
  );

  // Calculate percentages for breakdowns
  const totalTasks = parseInt(summaryResult.rows[0].total_tasks);
  
  return {
    summary: {
      totalTasks: parseInt(summaryResult.rows[0]?.total_tasks || '0'),
      completedTasks: parseInt(summaryResult.rows[0]?.completed_tasks || '0'),
      completionRate: parseFloat(summaryResult.rows[0]?.completion_rate || '0'),
      overdueTasks: parseInt(summaryResult.rows[0]?.overdue_tasks || '0'),
      avgCompletionTime: summaryResult.rows[0]?.avg_completion_time !== null 
        ? parseFloat(summaryResult.rows[0].avg_completion_time) 
        : 0
    },
    statusBreakdown: statusResult.rows.map(row => ({
      status: row.status || 'Unknown',
      count: parseInt(row.count || '0'),
      percentage: totalTasks > 0 
        ? ((parseInt(row.count || '0') / totalTasks) * 100).toFixed(1)
        : '0.0'
    })),
    priorityBreakdown: priorityResult.rows.map(row => ({
      priority: row.priority || 'Unknown',
      count: parseInt(row.count || '0'),
      percentage: totalTasks > 0 
        ? ((parseInt(row.count || '0') / totalTasks) * 100).toFixed(1)
        : '0.0'
    })),
    employeePerformance: employeeResult.rows.map(row => ({
      employeeName: row.employee_name || 'Unknown',
      totalTasks: parseInt(row.total_tasks || '0'),
      completedTasks: parseInt(row.completed_tasks || '0'),
      onTimeCompletion: parseFloat(row.on_time_completion || '0'),
      avgCompletionTime: row.avg_completion_time !== null 
        ? parseFloat(row.avg_completion_time) 
        : 0
    })),
    companyInfo: {
      name: companyInfo.name || '',
      logo: companyInfo.logo || '',
      address: companyInfo.address || '',
      contact: companyInfo.contact || ''
    }
  };
}

async function getTravelReportData(client: PoolClient, adminId: string) {
  // Get summary data
  const summaryResult = await client.query(`
    SELECT 
      COUNT(*) as total_trips,
      COUNT(DISTINCT user_id) as total_travelers,
      SUM(total_kilometers) as total_distance,
      SUM(total_amount) as total_expenses,
      ROUND(AVG(total_amount)::numeric, 2) as avg_trip_cost
    FROM expenses
    WHERE group_admin_id = $1
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND total_kilometers > 0`,
    [adminId]
  );

  // Get expense breakdown by category
  const expenseBreakdown = await client.query(`
    SELECT 
      category_name,
      SUM(amount) as amount
    FROM (
      SELECT 'Lodging' as category_name, lodging_expenses as amount
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND lodging_expenses > 0
      
      UNION ALL
      
      SELECT 'Daily Allowance', daily_allowance
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND daily_allowance > 0
      
      UNION ALL
      
      SELECT 'Fuel', diesel
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND diesel > 0
      
      UNION ALL
      
      SELECT 'Toll', toll_charges
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND toll_charges > 0
      
      UNION ALL
      
      SELECT 'Other', other_expenses
      FROM expenses
      WHERE group_admin_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND other_expenses > 0
    ) as expense_categories
    GROUP BY category_name
    ORDER BY amount DESC`,
    [adminId]
  );

  // Get vehicle statistics
  const vehicleStats = await client.query(`
    SELECT 
      vehicle_type,
      COUNT(*) as trip_count,
      SUM(total_kilometers) as total_distance,
      SUM(total_amount) as total_expenses
    FROM expenses
    WHERE group_admin_id = $1
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND vehicle_type IS NOT NULL
    GROUP BY vehicle_type
    ORDER BY trip_count DESC`,
    [adminId]
  );

  // Get employee travel statistics
  const employeeStats = await client.query(`
    SELECT 
      u.name as employee_name,
      COUNT(*) as trip_count,
      SUM(e.total_kilometers) as total_distance,
      SUM(e.total_amount) as total_expenses,
      ROUND(AVG(e.total_amount)::numeric, 2) as avg_expense_per_trip
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.group_admin_id = $1
    AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND e.total_kilometers > 0
    GROUP BY u.id, u.name
    ORDER BY trip_count DESC`,
    [adminId]
  );

  // Get recent trips
  const recentTrips = await client.query(`
    SELECT 
      u.name as employee_name,
      e.date,
      e.route_taken as route,
      e.total_kilometers as distance,
      e.total_amount as expenses
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.group_admin_id = $1
    AND e.total_kilometers > 0
    ORDER BY e.date DESC
    LIMIT 10`,
    [adminId]
  );

  // Calculate total expenses for percentages
  const totalExpenses = parseFloat(summaryResult.rows[0]?.total_expenses || '0');

  return {
    summary: {
      totalTrips: parseInt(summaryResult.rows[0]?.total_trips || '0'),
      totalDistance: parseFloat(summaryResult.rows[0]?.total_distance || '0'),
      totalExpenses: parseFloat(summaryResult.rows[0]?.total_expenses || '0'),
      avgTripCost: parseFloat(summaryResult.rows[0]?.avg_trip_cost || '0'),
      totalTravelers: parseInt(summaryResult.rows[0]?.total_travelers || '0')
    },
    expenseBreakdown: expenseBreakdown.rows.map(row => ({
      category: row.category_name,
      amount: parseFloat(row.amount || '0'),
      percentage: totalExpenses ? ((parseFloat(row.amount) / totalExpenses) * 100).toFixed(1) : '0'
    })),
    vehicleStats: vehicleStats.rows.map(row => ({
      vehicleType: row.vehicle_type || 'Unknown',
      tripCount: parseInt(row.trip_count || '0'),
      totalDistance: parseFloat(row.total_distance || '0'),
      totalExpenses: parseFloat(row.total_expenses || '0')
    })),
    employeeStats: employeeStats.rows.map(row => ({
      employeeName: row.employee_name,
      tripCount: parseInt(row.trip_count || '0'),
      totalDistance: parseFloat(row.total_distance || '0'),
      totalExpenses: parseFloat(row.total_expenses || '0'),
      avgExpensePerTrip: parseFloat(row.avg_expense_per_trip || '0')
    })),
    recentTrips: recentTrips.rows.map(row => ({
      employeeName: row.employee_name,
      date: new Date(row.date).toLocaleDateString(),
      route: row.route || 'N/A',
      distance: parseFloat(row.distance || '0'),
      expenses: parseFloat(row.expenses || '0')
    }))
  };
}

async function getPerformanceReportData(client: PoolClient, adminId: string) {
  // Get summary metrics
  const summaryResult = await client.query(`
    WITH metrics AS (
      SELECT 
        COUNT(DISTINCT u.id) as total_employees,
        -- Attendance metrics
        ROUND(AVG(
          CASE WHEN es.end_time IS NOT NULL AND es.start_time IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600 
          END
        )::numeric, 1) as avg_working_hours,
        -- Task metrics
        ROUND((COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::float * 100 / 
          NULLIF(COUNT(t.id), 0))::numeric, 1) as task_completion_rate,
        -- Expense metrics
        ROUND((COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::float * 100 / 
          NULLIF(COUNT(e.id), 0))::numeric, 1) as expense_approval_rate
      FROM users u
      LEFT JOIN employee_shifts es ON u.id = es.user_id
        AND es.start_time >= CURRENT_DATE - INTERVAL '30 days'
      LEFT JOIN employee_tasks t ON u.id = t.assigned_to
        AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
      LEFT JOIN expenses e ON u.id = e.user_id
        AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
      WHERE u.group_admin_id = $1
      AND u.role = 'employee'
    )
    SELECT * FROM metrics`,
    [adminId]
  );

  // Get employee performance details
  const employeeResult = await client.query(`
    SELECT 
      u.name as employee_name,
      u.employee_number,
      -- Attendance metrics
      COUNT(DISTINCT DATE(es.start_time)) as days_present,
      ROUND((COUNT(CASE WHEN EXTRACT(HOUR FROM es.start_time) <= 9 THEN 1 END)::float * 100 / 
        NULLIF(COUNT(es.id), 0))::numeric, 1) as on_time_rate,
      ROUND(AVG(
        CASE WHEN es.end_time IS NOT NULL AND es.start_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600 
        END
      )::numeric, 1) as avg_working_hours,
      -- Task metrics
      COUNT(t.id) as total_tasks,
      ROUND((COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::float * 100 / 
        NULLIF(COUNT(t.id), 0))::numeric, 1) as task_completion_rate,
      ROUND((COUNT(CASE WHEN t.status = 'completed' AND t.updated_at <= t.due_date THEN 1 END)::float * 100 / 
        NULLIF(COUNT(CASE WHEN t.status = 'completed' THEN 1 END), 0))::numeric, 1) as on_time_completion,
      -- Expense metrics
      COUNT(e.id) as total_expenses,
      ROUND((COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::float * 100 / 
        NULLIF(COUNT(e.id), 0))::numeric, 1) as expense_approval_rate,
      ROUND(AVG(
        CASE WHEN e.status IN ('approved', 'rejected')
        THEN EXTRACT(EPOCH FROM (e.updated_at - e.created_at))/3600 
        END
      )::numeric, 1) as avg_processing_time
    FROM users u
    LEFT JOIN employee_shifts es ON u.id = es.user_id 
      AND es.start_time >= CURRENT_DATE - INTERVAL '30 days'
    LEFT JOIN employee_tasks t ON u.id = t.assigned_to 
      AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
    LEFT JOIN expenses e ON u.id = e.user_id 
      AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
    WHERE u.group_admin_id = $1
    AND u.role = 'employee'
    GROUP BY u.id, u.name, u.employee_number`,
    [adminId]
  );

  // Get department statistics
  const departmentResult = await client.query(`
    SELECT 
      u.department,
      COUNT(DISTINCT u.id) as employee_count,
      ROUND(AVG(
        CASE WHEN es.end_time IS NOT NULL AND es.start_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600 
        END
      )::numeric, 1) as avg_attendance,
      ROUND((COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::float * 100 / 
        NULLIF(COUNT(t.id), 0))::numeric, 1) as avg_task_completion,
      ROUND((COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::float * 100 / 
        NULLIF(COUNT(e.id), 0))::numeric, 1) as avg_expense_approval
    FROM users u
    LEFT JOIN employee_shifts es ON u.id = es.user_id
      AND es.start_time >= CURRENT_DATE - INTERVAL '30 days'
    LEFT JOIN employee_tasks t ON u.id = t.assigned_to
      AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
    LEFT JOIN expenses e ON u.id = e.user_id
      AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
    WHERE u.group_admin_id = $1
    AND u.role = 'employee'
    AND u.department IS NOT NULL
    GROUP BY u.department
    ORDER BY employee_count DESC`,
    [adminId]
  );

  // Process the results with null handling
  const summary = {
    totalEmployees: parseInt(summaryResult.rows[0]?.total_employees || '0'),
    avgAttendance: parseFloat(summaryResult.rows[0]?.avg_working_hours || '0'),
    avgTaskCompletion: parseFloat(summaryResult.rows[0]?.task_completion_rate || '0'),
    avgExpenseApproval: parseFloat(summaryResult.rows[0]?.expense_approval_rate || '0')
  };

  const employeePerformance = employeeResult.rows.map(emp => ({
    employeeName: emp.employee_name || '',
    employeeNumber: emp.employee_number || '',
    attendance: {
      daysPresent: parseInt(emp.days_present || '0'),
      onTimeRate: parseFloat(emp.on_time_rate || '0'),
      avgWorkingHours: parseFloat(emp.avg_working_hours || '0')
    },
    tasks: {
      totalAssigned: parseInt(emp.total_tasks || '0'),
      completionRate: parseFloat(emp.task_completion_rate || '0'),
      onTimeCompletion: parseFloat(emp.on_time_completion || '0')
    },
    expenses: {
      totalSubmitted: parseInt(emp.total_expenses || '0'),
      approvalRate: parseFloat(emp.expense_approval_rate || '0'),
      avgProcessingTime: parseFloat(emp.avg_processing_time || '0')
    }
  }));

  // Calculate top performers
  const topPerformers = employeePerformance
    .map(emp => {
      const score = (
        emp.attendance.onTimeRate +
        emp.tasks.completionRate +
        emp.expenses.approvalRate
      ) / 3;

      const highlights = [];
      if (emp.attendance.onTimeRate >= 90) highlights.push('Excellent attendance');
      if (emp.tasks.completionRate >= 90) highlights.push('High task completion');
      if (emp.expenses.approvalRate >= 90) highlights.push('Excellent expense management');

      return {
        employeeName: emp.employeeName,
        department: departmentResult.rows.find(d => d.department)?.department || 'N/A',
        score: Math.round(score),
        highlights
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    summary,
    employeePerformance,
    departmentStats: departmentResult.rows.map(dept => ({
      department: dept.department || 'N/A',
      employeeCount: parseInt(dept.employee_count || '0'),
      avgAttendance: parseFloat(dept.avg_attendance || '0'),
      avgTaskCompletion: parseFloat(dept.avg_task_completion || '0'),
      avgExpenseApproval: parseFloat(dept.avg_expense_approval || '0')
    })),
    topPerformers
  };
}

async function getLeaveReportData(client: PoolClient, adminId: string) {
  // Get summary data
  const summaryResult = await client.query(`
    WITH leave_stats AS (
      SELECT 
        COUNT(*) as total_leaves,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_leaves,
        COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_leaves,
        COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_leaves,
        AVG(EXTRACT(EPOCH FROM (lr.updated_at - lr.created_at))/3600) as avg_processing_time
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE u.group_admin_id = $1
      AND lr.created_at >= CURRENT_DATE - INTERVAL '12 months'
    )
    SELECT *
    FROM leave_stats`,
    [adminId]
  );

  // Get leave type breakdown with calculated days
  const typeBreakdown = await client.query(`
    SELECT 
      lt.name as type,
      COUNT(*) as count,
      SUM(
        CASE 
          WHEN lr.end_date >= lr.start_date 
          THEN (lr.end_date - lr.start_date) + 1
          ELSE lr.days_requested
        END
      ) as total_days
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    JOIN users u ON lr.user_id = u.id
    WHERE u.group_admin_id = $1
    AND lr.created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY lt.name
    ORDER BY count DESC`,
    [adminId]
  );

  // Get monthly distribution
  const monthlyDistribution = await client.query(`
    SELECT 
      TO_CHAR(lr.start_date, 'Month YYYY') as month,
      COUNT(*) as count,
      COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
      SUM(
        CASE 
          WHEN lr.end_date >= lr.start_date 
          THEN (lr.end_date - lr.start_date) + 1
          ELSE lr.days_requested
        END
      ) as total_days
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE u.group_admin_id = $1
    AND lr.created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY TO_CHAR(lr.start_date, 'Month YYYY'), DATE_TRUNC('month', lr.start_date)
    ORDER BY DATE_TRUNC('month', lr.start_date) DESC`,
    [adminId]
  );

  // Get employee statistics with leave balances
  const employeeStats = await client.query(`
    WITH leave_counts AS (
      SELECT 
        lr.user_id,
        COUNT(*) as total_leaves,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_leaves,
        SUM(
          CASE 
            WHEN lr.end_date >= lr.start_date 
            THEN (lr.end_date - lr.start_date) + 1
            ELSE lr.days_requested
          END
        ) as total_days,
        json_agg(json_build_object(
          'type', lt.name,
          'count', 1,
          'days', CASE 
            WHEN lr.end_date >= lr.start_date 
            THEN (lr.end_date - lr.start_date) + 1
            ELSE lr.days_requested
          END
        )) as leave_types
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      WHERE u.group_admin_id = $1
      AND lr.created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY lr.user_id
    ),
    leave_balance_data AS (
      SELECT 
        lb.user_id,
        SUM(CASE WHEN lt.name ILIKE '%casual%' THEN (lb.total_days - lb.used_days - lb.pending_days) ELSE 0 END) as casual_leave_balance,
        SUM(CASE WHEN lt.name ILIKE '%sick%' THEN (lb.total_days - lb.used_days - lb.pending_days) ELSE 0 END) as sick_leave_balance,
        SUM(CASE WHEN lt.name ILIKE '%annual%' OR lt.name ILIKE '%privilege%' THEN (lb.total_days - lb.used_days - lb.pending_days) ELSE 0 END) as annual_leave_balance,
        SUM(lb.total_days) as total_balance,
        SUM(lb.used_days) as used_balance,
        SUM(lb.pending_days) as pending_balance
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      JOIN users u ON lb.user_id = u.id
      WHERE u.group_admin_id = $1
      AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY lb.user_id
    )
    SELECT 
      u.name as employee_name,
      COALESCE(lc.total_leaves, 0) as total_leaves,
      COALESCE(lc.approved_leaves, 0) as approved_leaves,
      COALESCE(lc.total_days, 0) as total_days,
      COALESCE(lb.casual_leave_balance, 0) as casual_leave_balance,
      COALESCE(lb.sick_leave_balance, 0) as sick_leave_balance,
      COALESCE(lb.annual_leave_balance, 0) as annual_leave_balance,
      COALESCE(lb.total_balance, 0) as total_balance,
      COALESCE(lb.used_balance, 0) as used_balance,
      COALESCE(lb.pending_balance, 0) as pending_balance,
      COALESCE(lc.leave_types, '[]') as leave_types
    FROM users u
    LEFT JOIN leave_counts lc ON u.id = lc.user_id
    LEFT JOIN leave_balance_data lb ON u.id = lb.user_id
    WHERE u.group_admin_id = $1
    AND u.role = 'employee'`,
    [adminId]
  );

  // Get recent leave requests
  const recentLeaves = await client.query(`
    SELECT 
      u.name as employee_name,
      lt.name as type,
      lr.start_date,
      lr.end_date,
      CASE 
        WHEN lr.days_requested > 0 THEN lr.days_requested
        WHEN lr.end_date >= lr.start_date THEN (lr.end_date - lr.start_date) + 1
        ELSE 0
      END as days,
      lr.status
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE u.group_admin_id = $1
    ORDER BY lr.created_at DESC
    LIMIT 10`,
    [adminId]
  );

  // Calculate total for percentages
  const totalLeaves = parseInt(summaryResult.rows[0]?.total_leaves || '0');

  return {
    summary: {
      totalLeaves,
      approvedLeaves: parseInt(summaryResult.rows[0]?.approved_leaves || '0'),
      pendingLeaves: parseInt(summaryResult.rows[0]?.pending_leaves || '0'),
      rejectedLeaves: parseInt(summaryResult.rows[0]?.rejected_leaves || '0'),
      avgProcessingTime: parseFloat(summaryResult.rows[0]?.avg_processing_time || '0')
    },
    leaveTypeBreakdown: typeBreakdown.rows.map(row => ({
      type: row.type,
      count: parseInt(row.count || '0'),
      totalDays: parseInt(row.total_days || '0'),
      percentage: totalLeaves ? Math.round((parseInt(row.count) / totalLeaves) * 100) : 0
    })),
    monthlyDistribution: monthlyDistribution.rows.map(row => ({
      month: row.month.trim(),
      count: parseInt(row.count || '0'),
      approvedCount: parseInt(row.approved_count || '0'),
      totalDays: parseInt(row.total_days || '0')
    })),
    employeeStats: employeeStats.rows.map(row => ({
      employeeName: row.employee_name,
      totalLeaves: parseInt(row.total_leaves || '0'),
      approvedLeaves: parseInt(row.approved_leaves || '0'),
      totalDays: parseInt(row.total_days || '0'),
      leaveBalance: {
        casual: parseInt(row.casual_leave_balance || '0'),
        sick: parseInt(row.sick_leave_balance || '0'),
        annual: parseInt(row.annual_leave_balance || '0')
      },
      totalBalance: parseInt(row.total_balance || '0'),
      usedBalance: parseInt(row.used_balance || '0'),
      pendingBalance: parseInt(row.pending_balance || '0'),
      leaveTypes: row.leave_types || []
    })),
    recentLeaves: recentLeaves.rows.map(row => ({
      employeeName: row.employee_name,
      type: row.type,
      startDate: new Date(row.start_date).toLocaleDateString(),
      endDate: new Date(row.end_date).toLocaleDateString(),
      days: parseInt(row.days || '0'),
      status: row.status
    }))
  };
}

export default router; 