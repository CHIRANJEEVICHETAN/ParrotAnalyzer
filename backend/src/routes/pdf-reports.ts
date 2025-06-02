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

// Helper function to process date filters
const processDateFilters = (
  startDateParam?: string, 
  endDateParam?: string
): { startDate: Date, endDate: Date } => {
  const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
  const endDate = endDateParam ? new Date(endDateParam) : new Date(); // Default to today
  
  // Validate the dates to ensure they are valid Date objects
  if (isNaN(startDate.getTime())) {
    console.warn(`Invalid start date provided: ${startDateParam}, using default`);
    startDate.setTime(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }
  
  if (isNaN(endDate.getTime())) {
    console.warn(`Invalid end date provided: ${endDateParam}, using default`);
    endDate.setTime(Date.now());
  }
  
  // Make sure to include the entire end date (to 23:59:59)
  endDate.setHours(23, 59, 59, 999);
  
  return { startDate, endDate };
};

// Get PDF data for specific report type
router.get('/:type', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { type } = req.params;
    const { startDate: startDateParam, endDate: endDateParam, employeeId, department } = req.query;
    
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

    // Validate filter parameters
    const filterOptions: FilterOptions = {};
    if (startDateParam) filterOptions.startDate = startDateParam as string;
    if (endDateParam) filterOptions.endDate = endDateParam as string;
    if (employeeId && employeeId !== 'undefined' && employeeId !== 'null') filterOptions.employeeId = employeeId as string;
    if (department && department !== 'undefined' && department !== 'null') filterOptions.department = department as string;

    let data;
    try {
      switch (type) {
        case 'expense':
          data = await getExpenseReportData(client, adminId.toString(), filterOptions);
          break;
        case 'attendance':
          data = await getAttendanceReportData(client, adminId.toString(), filterOptions);
          break;
        case 'task':
          data = await getTaskReportData(client, adminId.toString(), filterOptions);
          break;
        case 'travel':
          data = await getTravelReportData(client, adminId.toString(), filterOptions);
          break;
        case 'performance':
          data = await getPerformanceReportData(client, adminId.toString(), filterOptions);
          break;
        case 'leave':
          data = await getLeaveReportData(client, adminId.toString(), filterOptions);
          break;
        default:
          return res.status(400).json({ error: 'Invalid report type' });
      }
    } catch (error: any) {
      console.error(`Error fetching ${type} report data:`, error);
      // Return a user-friendly error
      return res.status(500).json({ 
        error: `Failed to generate ${type} report`, 
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          hint: error.hint
        } : undefined
      });
    }

    // Add both company info and admin name to the response
    res.json({
      ...data,
      companyInfo,
      adminName,
      filterOptions // Include the filters used in the response
    });
  } catch (error: any) {
    console.error('Error fetching PDF report data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch report data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

interface FilterOptions {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  department?: string;
}

// Add this interface before the getAttendanceReportData function
interface ShiftDetail {
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  distance: number;
  expenses: number;
  status: string;
}

async function getExpenseReportData(client: PoolClient, adminId: string, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Prepare filter conditions
  let employeeFilter = '';
  let departmentFilter = '';
  let params: any[] = [adminId];
  let paramIndex = 2; // Start with $2 since $1 is adminId
  
  if (filters.employeeId) {
    employeeFilter = `AND e.user_id = $${paramIndex++}`;
    params.push(parseInt(filters.employeeId));
  }
  
  if (filters.department) {
    departmentFilter = `AND u.department = $${paramIndex++}`;
    params.push(filters.department);
  }
  
  // Add date parameters
  params.push(startDate, endDate);
  const dateParamIndex = paramIndex;
  
  // Get summary data with filters
  const summaryResult = await client.query(`
    SELECT 
      COUNT(*) as total_claims,
      SUM(e.total_amount) as total_expenses,
      AVG(e.total_amount) as average_expense,
      COUNT(CASE WHEN e.status = 'pending' THEN 1 END) as pending_count,
      ROUND(
        (COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::float * 100 / 
        NULLIF(COUNT(*), 0))::numeric,
        1
      ) as approval_rate
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.group_admin_id = $1
    ${employeeFilter}
    ${departmentFilter}
    AND e.created_at >= $${dateParamIndex} AND e.created_at <= $${dateParamIndex + 1}`,
    params
  );

  // Include employees data for filters
  const employeesResult = await client.query(`
    SELECT 
      u.id,
      u.name,
      u.employee_number,
      u.department
    FROM users u
    WHERE u.group_admin_id = $1
    AND u.role = 'employee'
    ORDER BY u.name`,
    [adminId]
  );

  // Fixed category breakdown query
  const categoryResult = await client.query(`
    SELECT 
      category,
      SUM(amount) as amount
    FROM (
      SELECT 'Lodging' as category, e.lodging_expenses as amount
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1 
      ${employeeFilter}
      ${departmentFilter}
      AND e.created_at >= $${dateParamIndex} AND e.created_at <= $${dateParamIndex + 1}
      AND e.lodging_expenses > 0
      
      UNION ALL
      
      SELECT 'Daily Allowance', e.daily_allowance
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1 
      ${employeeFilter}
      ${departmentFilter}
      AND e.created_at >= $${dateParamIndex} AND e.created_at <= $${dateParamIndex + 1}
      AND e.daily_allowance > 0
      
      UNION ALL
      
      SELECT 'Fuel', e.diesel
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1 
      ${employeeFilter}
      ${departmentFilter}
      AND e.created_at >= $${dateParamIndex} AND e.created_at <= $${dateParamIndex + 1}
      AND e.diesel > 0
      
      UNION ALL
      
      SELECT 'Toll', e.toll_charges
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1 
      ${employeeFilter}
      ${departmentFilter}
      AND e.created_at >= $${dateParamIndex} AND e.created_at <= $${dateParamIndex + 1}
      AND e.toll_charges > 0
      
      UNION ALL
      
      SELECT 'Other', e.other_expenses
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1 
      ${employeeFilter}
      ${departmentFilter}
      AND e.created_at >= $${dateParamIndex} AND e.created_at <= $${dateParamIndex + 1}
      AND e.other_expenses > 0
    ) as expense_categories
    GROUP BY category
    ORDER BY amount DESC`,
    params
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
    ${employeeFilter}
    ${departmentFilter}
    AND e.created_at >= $${dateParamIndex} AND e.created_at <= $${dateParamIndex + 1}
    ORDER BY e.date DESC`,
    params
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
    })),
    employees: employeesResult.rows,
    departments: [...new Set(employeesResult.rows.map(emp => emp.department).filter(Boolean))]
  };
}

async function getAttendanceReportData(client: PoolClient, adminId: string, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Prepare filter conditions
  let employeeFilter = '';
  let departmentFilter = '';
  let params: any[] = [adminId];
  let paramIndex = 2; // Start with $2 since $1 is adminId
  
  if (filters.employeeId) {
    employeeFilter = `AND es.user_id = $${paramIndex++}`;
    params.push(parseInt(filters.employeeId));
  }
  
  if (filters.department) {
    departmentFilter = `AND u.department = $${paramIndex++}`;
    params.push(filters.department);
  }

  // Add date parameters
  params.push(startDate, endDate);
  const dateParamIndex = paramIndex;

  // Get summary data
  const summaryResult = await client.query(`
    WITH employee_stats AS (
      SELECT 
        COUNT(DISTINCT es.user_id) as total_employees,
        AVG(EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600) as avg_hours,
        SUM(e.total_kilometers) as total_distance,
        SUM(e.total_amount) as total_expenses,
        COUNT(CASE 
          WHEN EXTRACT(HOUR FROM es.start_time) <= 9 THEN 1 
        END)::float / NULLIF(COUNT(*), 0) * 100 as on_time_rate,
        COUNT(CASE WHEN es.status = 'completed' THEN 1 END) as completed_shifts,
        COUNT(CASE WHEN es.status = 'active' THEN 1 END) as active_shifts,
        SUM(EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600) as total_hours
      FROM employee_shifts es
      JOIN users u ON es.user_id = u.id
      LEFT JOIN expenses e ON e.user_id = es.user_id 
        AND DATE(e.date) = DATE(es.start_time)
      WHERE u.group_admin_id = $1
      ${employeeFilter}
      ${departmentFilter}
      AND DATE(es.start_time) >= $${dateParamIndex}::date 
      AND DATE(es.start_time) <= $${dateParamIndex + 1}::date
    )
    SELECT 
      total_employees,
      ROUND(avg_hours::numeric, 1) as avg_working_hours,
      ROUND(on_time_rate::numeric, 1) as on_time_rate,
      ROUND(total_distance::numeric, 1) as total_distance,
      ROUND(total_expenses::numeric, 1) as total_expenses,
      completed_shifts,
      active_shifts,
      ROUND(total_hours::numeric, 1) as total_working_hours
    FROM employee_stats`,
    params.map((param, i) => {
      if (i >= dateParamIndex - 1 && param instanceof Date) {
        return param.toISOString().split('T')[0];
      }
      return param;
    })
  );
  
  // Include employees data for filters
  const employeesResult = await client.query(`
    SELECT 
      u.id,
      u.name,
      u.employee_number,
      u.department,
      u.role
    FROM users u
    WHERE u.group_admin_id = $1
    AND (u.role = 'employee' OR u.id = $1)
    ORDER BY u.name`,
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
      COALESCE(SUM(e.total_kilometers), 0) as total_distance,
      COALESCE(SUM(e.total_amount), 0) as total_expenses,
      COUNT(CASE WHEN es.status = 'completed' THEN 1 END) as completed_shifts,
      COUNT(CASE WHEN es.status = 'active' THEN 1 END) as incomplete_shifts
    FROM employee_shifts es
    JOIN users u ON es.user_id = u.id
    LEFT JOIN expenses e ON e.user_id = es.user_id 
      AND DATE(e.date) = DATE(es.start_time)
    WHERE u.group_admin_id = $1
    ${employeeFilter}
    ${departmentFilter}
    AND DATE(es.start_time) >= $${dateParamIndex}::date
    AND DATE(es.start_time) <= $${dateParamIndex + 1}::date
    GROUP BY DATE(es.start_time)
    ORDER BY date DESC`,
    params.map((param, i) => {
      if (i >= dateParamIndex - 1 && param instanceof Date) {
        return param.toISOString().split('T')[0];
      }
      return param;
    })
  );

  // Get employee statistics
  const employeeStatsParams: any[] = [adminId];
  let empStatsParamIndex = 2;
  
  // For employee stats query, we need to handle the employeeId parameter differently
  let empIdFilter = '';
  if (filters.employeeId) {
    empIdFilter = `AND u.id = $${empStatsParamIndex++}::integer`;
    employeeStatsParams.push(parseInt(filters.employeeId));
  } else {
    // Remove the NULL parameter check since it's causing problems
    empIdFilter = '';
  }
  
  // Add department filter if needed
  if (filters.department) {
    departmentFilter = `AND u.department = $${empStatsParamIndex++}`;
    employeeStatsParams.push(filters.department);
  }
  
  // Add date parameters
  employeeStatsParams.push(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
  const empDateParamIndex = empStatsParamIndex;

  const employeeStatsResult = await client.query(`
    SELECT 
      u.id,
      u.name as employee_name,
      u.role,
      u.department,
      COUNT(DISTINCT DATE(es.start_time)) as days_present,
      ROUND(AVG(EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600)::numeric, 1) as avg_hours,
      ROUND((COUNT(CASE 
        WHEN EXTRACT(HOUR FROM es.start_time) <= 9 THEN 1 
      END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 1) as on_time_percentage,
      COALESCE(SUM(e.total_kilometers), 0) as total_distance,
      COALESCE(SUM(e.total_amount), 0) as total_expenses,
      COUNT(CASE WHEN es.status = 'completed' THEN 1 END) as completed_shifts,
      COUNT(CASE WHEN es.status = 'active' THEN 1 END) as active_shifts,
      COUNT(CASE WHEN es.status != 'completed' AND es.status != 'active' THEN 1 END) as incomplete_shifts
    FROM users u
    LEFT JOIN employee_shifts es ON u.id = es.user_id
      AND DATE(es.start_time) >= $${empDateParamIndex}::date
      AND DATE(es.start_time) <= $${empDateParamIndex + 1}::date
    LEFT JOIN expenses e ON e.user_id = u.id 
      AND DATE(e.date) = DATE(es.start_time)
    WHERE u.group_admin_id = $1
    ${departmentFilter}
    ${empIdFilter}
    AND u.role = 'employee'
    GROUP BY u.id, u.name, u.role, u.department
    ORDER BY days_present DESC`,
    employeeStatsParams.map(param => {
      if (param instanceof Date) {
        return param.toISOString().split('T')[0];
      }
      return param;
    })
  );
  
  // If a specific employee is selected, get their detailed shift data
  let shiftDetails: ShiftDetail[] = [];
  if (filters.employeeId) {
    const shiftDetailsResult = await client.query(`
      SELECT 
        u.name as employee_name,
        DATE(es.start_time) as date,
        to_char(es.start_time, 'HH12:MI AM') as start_time,
        to_char(es.end_time, 'HH12:MI AM') as end_time,
        CASE 
          WHEN es.end_time IS NOT NULL
          THEN EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600 
          ELSE 0 
        END as duration,
        COALESCE(e.total_kilometers, 0) as distance,
        COALESCE(e.total_amount, 0) as expenses,
        es.status
      FROM employee_shifts es
      JOIN users u ON es.user_id = u.id
      LEFT JOIN expenses e ON e.shift_id = es.id
      WHERE es.user_id = $2::integer
      AND DATE(es.start_time) >= $3::date
      AND DATE(es.start_time) <= $4::date
      ORDER BY es.start_time DESC`,
      [adminId, parseInt(filters.employeeId), startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );
    
    shiftDetails = shiftDetailsResult.rows.map(row => ({
      employeeName: row.employee_name,
      date: new Date(row.date).toLocaleDateString(),
      startTime: row.start_time,
      endTime: row.end_time || 'N/A',
      duration: parseFloat(row.duration || '0'),
      distance: parseFloat(row.distance || '0'),
      expenses: parseFloat(row.expenses || '0'),
      status: row.status
    }));
  }

  const summaryData = summaryResult.rows[0] || {};

  return {
    summary: {
      totalEmployees: parseInt(summaryData.total_employees || '0'),
      avgWorkingHours: parseFloat(summaryData.avg_working_hours || '0'),
      onTimeRate: parseFloat(summaryData.on_time_rate || '0'),
      totalDistance: parseFloat(summaryData.total_distance || '0'),
      totalExpenses: parseFloat(summaryData.total_expenses || '0'),
      completedShifts: parseInt(summaryData.completed_shifts || '0'),
      activeShifts: parseInt(summaryData.active_shifts || '0'),
      totalWorkingHours: parseFloat(summaryData.total_working_hours || '0')
    },
    dailyStats: dailyStatsResult.rows.map(row => ({
      date: new Date(row.date).toLocaleDateString(),
      presentCount: parseInt(row.present_count || '0'),
      onTimeCount: parseInt(row.on_time_count || '0'),
      totalHours: parseFloat(row.total_hours || '0'),
      totalDistance: parseFloat(row.total_distance || '0'),
      totalExpenses: parseFloat(row.total_expenses || '0'),
      completedShifts: parseInt(row.completed_shifts || '0'),
      incompleteShifts: parseInt(row.incomplete_shifts || '0')
    })),
    employeeStats: employeeStatsResult.rows.map(row => ({
      id: row.id,
      employeeName: row.employee_name,
      role: row.role || 'Employee',
      department: row.department || 'N/A',
      daysPresent: parseInt(row.days_present || '0'),
      avgHours: parseFloat(row.avg_hours || '0'),
      onTimePercentage: parseFloat(row.on_time_percentage || '0'),
      totalDistance: parseFloat(row.total_distance || '0'),
      totalExpenses: parseFloat(row.total_expenses || '0'),
      shiftStatus: {
        completed: parseInt(row.completed_shifts || '0'),
        active: parseInt(row.active_shifts || '0'),
        incomplete: parseInt(row.incomplete_shifts || '0')
      }
    })),
    employees: employeesResult.rows,
    departments: [...new Set(employeesResult.rows.map(emp => emp.department).filter(Boolean))],
    shiftDetails: shiftDetails
  };
}

async function getTaskReportData(client: PoolClient, adminId: string, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Prepare filter conditions
  let employeeFilter = '';
  let departmentFilter = '';
  let params: any[] = [adminId];
  let paramIndex = 2; // Start with $2 since $1 is adminId
  
  if (filters.employeeId) {
    employeeFilter = `AND et.assigned_to = $${paramIndex++}`;
    params.push(parseInt(filters.employeeId));
  }
  
  if (filters.department) {
    departmentFilter = `AND u.department = $${paramIndex++}`;
    params.push(filters.department);
  }
  
  // Add date parameters
  params.push(startDate, endDate);
  const dateParamIndex = paramIndex;
  
  // Prepare parameters with proper date formatting
  const formattedParams = params.map((param, i) => {
    if (i >= dateParamIndex - 1 && param instanceof Date) {
      return param.toISOString().split('T')[0];
    }
    return param;
  });
  
  // Get task summary
  const summaryResult = await client.query(`
    WITH task_stats AS (
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN et.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE 
          WHEN et.due_date < CURRENT_TIMESTAMP AND et.status != 'completed' 
          THEN 1 END) as overdue_tasks,
        AVG(
          CASE WHEN et.status = 'completed' AND et.last_status_update IS NOT NULL
          THEN EXTRACT(EPOCH FROM (et.last_status_update - et.created_at))/3600 
          END
        ) as avg_completion_time
      FROM employee_tasks et
      JOIN users u ON et.assigned_to = u.id
      WHERE et.assigned_by = $1
      ${employeeFilter}
      ${departmentFilter}
      AND et.created_at >= $${dateParamIndex}::date
      AND et.created_at <= $${dateParamIndex + 1}::date
    )
    SELECT 
      total_tasks,
      completed_tasks,
      overdue_tasks,
      ROUND(avg_completion_time::numeric, 1) as avg_completion_time,
      ROUND((completed_tasks::float * 100 / NULLIF(total_tasks, 0))::numeric, 1) as completion_rate
    FROM task_stats`,
    formattedParams
  );

  return {
    summary: {
      totalTasks: parseInt(summaryResult.rows[0]?.total_tasks || '0'),
      completedTasks: parseInt(summaryResult.rows[0]?.completed_tasks || '0'),
      overdueTasks: parseInt(summaryResult.rows[0]?.overdue_tasks || '0'),
      avgCompletionTime: parseFloat(summaryResult.rows[0]?.avg_completion_time || '0'),
      completionRate: parseFloat(summaryResult.rows[0]?.completion_rate || '0')
    }
  };
}

async function getTravelReportData(client: PoolClient, adminId: string, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Prepare filter conditions
  let employeeFilter = '';
  let departmentFilter = '';
  let params: any[] = [adminId];
  let paramIndex = 2; // Start with $2 since $1 is adminId
  
  if (filters.employeeId) {
    employeeFilter = `AND e.user_id = $${paramIndex++}`;
    params.push(parseInt(filters.employeeId));
  }
  
  if (filters.department) {
    departmentFilter = `AND u.department = $${paramIndex++}`;
    params.push(filters.department);
  }
  
  // Add date parameters
  params.push(startDate, endDate);
  const dateParamIndex = paramIndex;

  // Get travel metrics
  const summaryResult = await client.query(`
    SELECT 
      COUNT(DISTINCT e.user_id) as total_travelers,
      COUNT(*) as total_trips,
      ROUND(SUM(e.total_kilometers)::numeric, 2) as total_distance,
      ROUND(SUM(e.total_amount)::numeric, 2) as total_expenses,
      ROUND(AVG(e.total_amount)::numeric, 2) as avg_trip_cost
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.group_admin_id = $1
    ${employeeFilter}
    ${departmentFilter}
    AND e.date >= $${dateParamIndex}::date
    AND e.date <= $${dateParamIndex + 1}::date`,
    params.map((param, i) => {
      if (i >= dateParamIndex - 1 && param instanceof Date) {
        return param.toISOString().split('T')[0];
      }
      return param;
    })
  );

  // Get expense distribution by category
  const categoryResult = await client.query(`
    WITH expense_categories AS (
      SELECT 
        'Lodging' as category, SUM(e.lodging_expenses) as amount
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1
      ${employeeFilter}
      ${departmentFilter}
      AND e.date >= $${dateParamIndex}::date
      AND e.date <= $${dateParamIndex + 1}::date
      GROUP BY category
      
      UNION ALL
      
      SELECT 
        'Daily Allowance' as category, SUM(e.daily_allowance) as amount
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1
      ${employeeFilter}
      ${departmentFilter}
      AND e.date >= $${dateParamIndex}::date
      AND e.date <= $${dateParamIndex + 1}::date
      GROUP BY category
      
      UNION ALL
      
      SELECT 
        'Fuel' as category, SUM(e.diesel) as amount
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1
      ${employeeFilter}
      ${departmentFilter}
      AND e.date >= $${dateParamIndex}::date
      AND e.date <= $${dateParamIndex + 1}::date
      GROUP BY category
      
      UNION ALL
      
      SELECT 
        'Toll' as category, SUM(e.toll_charges) as amount
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1
      ${employeeFilter}
      ${departmentFilter}
      AND e.date >= $${dateParamIndex}::date
      AND e.date <= $${dateParamIndex + 1}::date
      GROUP BY category
      
      UNION ALL
      
      SELECT 
        'Other' as category, SUM(e.other_expenses) as amount
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.group_admin_id = $1
      ${employeeFilter}
      ${departmentFilter}
      AND e.date >= $${dateParamIndex}::date
      AND e.date <= $${dateParamIndex + 1}::date
      GROUP BY category
    )
    SELECT 
      category,
      COALESCE(amount, 0) as amount
    FROM expense_categories
    WHERE amount > 0
    ORDER BY amount DESC`,
    params.map((param, i) => {
      if (i >= dateParamIndex - 1 && param instanceof Date) {
        return param.toISOString().split('T')[0];
      }
      return param;
    })
  );

  // Calculate total expenses for percentages
  const total = categoryResult.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);

  // Return formatted data
  return {
    summary: {
      totalTravelers: parseInt(summaryResult.rows[0]?.total_travelers || '0'),
      totalTrips: parseInt(summaryResult.rows[0]?.total_trips || '0'),
      totalDistance: parseFloat(summaryResult.rows[0]?.total_distance || '0'),
      totalExpenses: parseFloat(summaryResult.rows[0]?.total_expenses || '0'),
      avgTripCost: parseFloat(summaryResult.rows[0]?.avg_trip_cost || '0')
    },
    categories: categoryResult.rows.map(row => ({
      category: row.category,
      amount: parseFloat(row.amount),
      percentage: total > 0 ? ((parseFloat(row.amount) / total) * 100).toFixed(1) : '0'
    }))
  };
}

async function getPerformanceReportData(client: PoolClient, adminId: string, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Prepare filter conditions
  let employeeFilter = '';
  let departmentFilter = '';
  let params: any[] = [adminId];
  let paramIndex = 2; // Start with $2 since $1 is adminId
  
  if (filters.employeeId) {
    employeeFilter = `AND u.id = $${paramIndex++}`;
    params.push(parseInt(filters.employeeId));
  }
  
  if (filters.department) {
    departmentFilter = `AND u.department = $${paramIndex++}`;
    params.push(filters.department);
  }
  
  // Add date parameters
  params.push(startDate, endDate);
  const dateParamIndex = paramIndex;

  // Get performance metrics
  const summaryResult = await client.query(`
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
        AND DATE(es.created_at) >= $${dateParamIndex}::date
        AND DATE(es.created_at) <= $${dateParamIndex + 1}::date
      WHERE u.group_admin_id = $1
      ${departmentFilter}
      ${employeeFilter}
      AND u.role = 'employee'
    ),
    task_metrics AS (
      SELECT 
        ROUND(
          (COUNT(CASE WHEN status = 'completed' THEN 1 END)::float * 100 / 
          NULLIF(COUNT(*), 0))::numeric, 
          1
        ) as task_completion_rate
      FROM employee_tasks
      JOIN users u ON u.id = assigned_to
      WHERE assigned_by = $1
      ${departmentFilter}
      ${employeeFilter}
      AND created_at >= $${dateParamIndex}::date
      AND created_at <= $${dateParamIndex + 1}::date
    ),
    expense_metrics AS (
      SELECT 
        ROUND(
          (COUNT(CASE WHEN status = 'approved' THEN 1 END)::float * 100 / 
          NULLIF(COUNT(*), 0))::numeric, 
          1
        ) as expense_approval_rate
      FROM expenses e
      JOIN users u ON u.id = e.user_id
      WHERE e.group_admin_id = $1
      ${departmentFilter}
      ${employeeFilter}
      AND e.created_at >= $${dateParamIndex}::date
      AND e.created_at <= $${dateParamIndex + 1}::date
    )
    SELECT 
      em.total_employees,
      ROUND(em.avg_working_hours::numeric, 1) as avg_working_hours,
      COALESCE(tm.task_completion_rate, 0) as task_completion_rate,
      COALESCE(ex.expense_approval_rate, 0) as expense_approval_rate
    FROM employee_metrics em
    CROSS JOIN task_metrics tm
    CROSS JOIN expense_metrics ex`,
    params.map((param, i) => {
      if (i >= dateParamIndex - 1 && param instanceof Date) {
        return param.toISOString().split('T')[0];
      }
      return param;
    })
  );

  // Return formatted data
  return {
    summary: {
      totalEmployees: parseInt(summaryResult.rows[0]?.total_employees || '0'),
      activeEmployees: parseInt(summaryResult.rows[0]?.active_employees || '0'),
      avgWorkingHours: parseFloat(summaryResult.rows[0]?.avg_working_hours || '0'),
      totalTasks: parseInt(summaryResult.rows[0]?.total_tasks || '0'),
      completedTasks: parseInt(summaryResult.rows[0]?.completed_tasks || '0'),
      taskCompletionRate: parseFloat(summaryResult.rows[0]?.task_completion_rate || '0'),
      expenseApprovalRate: parseFloat(summaryResult.rows[0]?.expense_approval_rate || '0')
    }
  };
}

async function getLeaveReportData(client: PoolClient, adminId: string, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Prepare filter conditions
  let employeeFilter = '';
  let departmentFilter = '';
  let params: any[] = [adminId];
  let paramIndex = 2; // Start with $2 since $1 is adminId
  
  if (filters.employeeId) {
    employeeFilter = `AND lr.user_id = $${paramIndex++}`;
    params.push(parseInt(filters.employeeId));
  }
  
  if (filters.department) {
    departmentFilter = `AND u.department = $${paramIndex++}`;
    params.push(filters.department);
  }
  
  // Add date parameters
  params.push(startDate, endDate);
  const dateParamIndex = paramIndex;
  
  // Prepare parameters with proper date formatting
  const formattedParams = params.map((param, i) => {
    if (i >= dateParamIndex - 1 && param instanceof Date) {
      return param.toISOString().split('T')[0];
    }
    return param;
  });
  
  // Get leave summary
  const summaryResult = await client.query(`
    WITH leave_stats AS (
      SELECT 
        COUNT(DISTINCT lr.user_id) as total_employees_on_leave,
        COUNT(*) as total_requests,
        SUM(CASE 
          WHEN lr.days_requested > 0 THEN lr.days_requested
          WHEN lr.end_date >= lr.start_date THEN (lr.end_date - lr.start_date) + 1
          ELSE 0
        END) as total_days,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
        COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_requests
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.group_admin_id = $1
      ${employeeFilter}
      ${departmentFilter}
      AND lr.created_at >= $${dateParamIndex}::date
      AND lr.created_at <= $${dateParamIndex + 1}::date
    )
    SELECT 
      total_employees_on_leave,
      total_requests,
      total_days,
      approved_requests,
      pending_requests,
      rejected_requests,
      CASE 
        WHEN total_requests > 0 
        THEN ROUND((approved_requests::float / total_requests::float) * 100)
        ELSE 0
      END as approval_rate
    FROM leave_stats`,
    formattedParams
  );

  return {
    summary: {
      totalEmployeesOnLeave: parseInt(summaryResult.rows[0]?.total_employees_on_leave || '0'),
      totalRequests: parseInt(summaryResult.rows[0]?.total_requests || '0'),
      totalDays: parseFloat(summaryResult.rows[0]?.total_days || '0'),
      approvedRequests: parseInt(summaryResult.rows[0]?.approved_requests || '0'),
      pendingRequests: parseInt(summaryResult.rows[0]?.pending_requests || '0'),
      rejectedRequests: parseInt(summaryResult.rows[0]?.rejected_requests || '0'),
      approvalRate: parseFloat(summaryResult.rows[0]?.approval_rate || '0')
    }
  };
}

export default router; 