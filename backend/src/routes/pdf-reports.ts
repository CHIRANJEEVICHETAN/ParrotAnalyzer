import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { PoolClient } from 'pg';

const router = express.Router();

// Add a geocoding cache to reduce API calls
const geocodingCache: Record<string, string> = {};

// Add this function at the top with other imports
async function getCompanyDetails(client: PoolClient, userId: number) {
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

// Replace the reverseGeocode function with this improved version that uses the cache
async function reverseGeocode(coordinates: any): Promise<string> {
  // If no coordinates, return placeholder
  if (!coordinates) {
    return 'N/A';
  }
  
  try {
    let latitude: number | undefined;
    let longitude: number | undefined;
    
    // Handle different formats of coordinates
    if (typeof coordinates === 'string') {
      // PostgreSQL point format: "(longitude,latitude)"
      const match = coordinates.match(/\(\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)/);
      if (match) {
        longitude = parseFloat(match[1]);
        latitude = parseFloat(match[3]);
      }
    } else if (coordinates.x !== undefined && coordinates.y !== undefined) {
      // PostgreSQL point object format: { x: longitude, y: latitude }
      longitude = coordinates.x;
      latitude = coordinates.y;
    } else if (coordinates.longitude !== undefined && coordinates.latitude !== undefined) {
      // Standard GeoJSON-like format
      longitude = coordinates.longitude;
      latitude = coordinates.latitude;
    }
    
    // Check if we were able to extract valid coordinates
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      console.log('Invalid or unparseable coordinates:', coordinates);
      return 'N/A';
    }
    
    // Create a cache key using rounded coordinates (reduce API calls for nearby points)
    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    
    // Check if we have this location cached
    if (geocodingCache[cacheKey]) {
      return geocodingCache[cacheKey];
    }
    
    // Use Google Maps Geocoding API to get address
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('No Google Maps API key found, returning coordinates');
      const result = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      geocodingCache[cacheKey] = result;
      return result;
    }
    
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
    );
    
    const data = await response.json();
    
    let result;
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Get the first result which is typically the most accurate
      const address = data.results[0].formatted_address;
      // Return a shortened version of the address
      result = shortenAddress(address);
    } else {
      result = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
    
    // Cache the result
    geocodingCache[cacheKey] = result;
    return result;
  } catch (error) {
    console.error('Error with reverse geocoding:', error);
    return 'N/A';
  }
}

// Helper function to shorten addresses
function shortenAddress(address: string): string {
  if (!address) return 'N/A';
  
  // Split address components
  const parts = address.split(',');
  
  // Return first 2-3 parts for a concise display
  if (parts.length > 3) {
    return parts.slice(0, 2).join(',');
  }
  
  return address;
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
    const companyInfo = await getCompanyDetails(client, adminId);

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
          data = await getExpenseReportData(client, adminId, filterOptions);
          break;
        case 'attendance':
          data = await getAttendanceReportData(client, adminId, filterOptions);
          break;
        case 'task':
          data = await getTaskReportData(client, adminId, filterOptions);
          break;
        case 'travel':
          data = await getTravelReportData(client, adminId, filterOptions);
          break;
        case 'performance':
          data = await getPerformanceReportData(client, adminId, filterOptions);
          break;
        case 'leave':
          data = await getLeaveReportData(client, adminId, filterOptions);
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

async function getExpenseReportData(client: PoolClient, adminId: number, filters: FilterOptions = {}) {
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

async function getAttendanceReportData(client: PoolClient, adminId: number, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Format dates for queries
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
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
  params.push(startDateStr, endDateStr);
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
    params
  );
  
  // Include employees data for filters with employee numbers
  const employeesResult = await client.query(`
    SELECT 
      u.id,
      u.name,
      u.employee_number,
      u.department,
      u.designation,
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
    params
  );

  // Get leave information for all employees in the date range
  const leaveInfoResult = await client.query(`
    SELECT 
      u.id as employee_id,
      u.name as employee_name,
      u.employee_number,
      u.department,
      lr.id as leave_id,
      lr.start_date,
      lr.end_date,
      CASE 
        WHEN lr.days_requested > 0 THEN lr.days_requested
        WHEN lr.end_date >= lr.start_date THEN (lr.end_date - lr.start_date) + 1
        ELSE 0
      END as days_count,
      lt.name as leave_type,
      lr.status as leave_status,
      lt.is_paid,
      lr.reason
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE u.group_admin_id = $1
    ${filters.employeeId ? 'AND u.id = $2' : ''}
    ${filters.department ? `AND u.department = $${filters.employeeId ? 3 : 2}` : ''}
    AND (
      (lr.start_date >= $${dateParamIndex}::date AND lr.start_date <= $${dateParamIndex + 1}::date)
      OR
      (lr.end_date >= $${dateParamIndex}::date AND lr.end_date <= $${dateParamIndex + 1}::date)
      OR
      (lr.start_date <= $${dateParamIndex}::date AND lr.end_date >= $${dateParamIndex + 1}::date)
    )
    ORDER BY lr.start_date, u.name`,
    params
  );

  // Get employee-level statistics with employee numbers
  let employeeStatsParams = [...params]; // Copy the basic params
  
  // For employee stats query, we need to handle the employeeId parameter differently
  const employeeStatsResult = await client.query(`
    SELECT 
      u.id,
      u.name as employee_name,
      u.employee_number,
      u.role,
      u.department,
      u.designation,
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
      AND DATE(es.start_time) >= $${dateParamIndex}::date
      AND DATE(es.start_time) <= $${dateParamIndex + 1}::date
    LEFT JOIN expenses e ON e.user_id = u.id 
      AND DATE(e.date) = DATE(es.start_time)
    WHERE u.group_admin_id = $1
    ${departmentFilter}
    ${filters.employeeId ? `AND u.id = $${filters.employeeId ? 2 : departmentFilter ? 3 : 2}` : ''}
    AND u.role = 'employee'
    GROUP BY u.id, u.name, u.employee_number, u.role, u.department, u.designation
    ORDER BY u.name`,
    employeeStatsParams
  );
  
  // Get all relevant employees (either filtered or all)
  let employeesToProcess = employeeStatsResult.rows;
  
  // Generate a date range for the report period
  const dateRange: Date[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateRange.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Structure for storing comprehensive employee attendance data
  const employeeAttendanceData: Record<string, any> = {};
  
  // Process each employee
  for (const employee of employeesToProcess) {
    const employeeId = employee.id;
    
    // Get detailed shift data for this specific employee
    const shiftDetailsResult = await client.query(`
      SELECT 
        u.id as employee_id,
        u.name as employee_name,
        u.employee_number,
        u.department,
        u.designation,
        DATE(es.start_time) as date,
        to_char(es.start_time, 'HH12:MI AM') as start_time,
        to_char(es.end_time, 'HH12:MI AM') as end_time,
        CASE 
          WHEN es.end_time IS NOT NULL
          THEN EXTRACT(EPOCH FROM (es.end_time - es.start_time))/3600 
          ELSE 0 
        END as duration,
        es.status,
        es.id as shift_id,
        es.total_kilometers as distance,
        es.total_expenses as expenses,
        es.ended_automatically,
        -- Convert point type to string representation that's easier to parse
        CASE 
          WHEN es.location_start IS NOT NULL 
          THEN '(' || es.location_start[0] || ',' || es.location_start[1] || ')'
          ELSE NULL
        END as location_start,
        CASE 
          WHEN es.location_end IS NOT NULL 
          THEN '(' || es.location_end[0] || ',' || es.location_end[1] || ')'
          ELSE NULL
        END as location_end
      FROM employee_shifts es
      JOIN users u ON es.user_id = u.id
      WHERE es.user_id = $1
      AND DATE(es.start_time) >= $2::date
      AND DATE(es.start_time) <= $3::date
      ORDER BY es.start_time`,
      [employeeId, startDateStr, endDateStr]
    );
    
    // Process the shift details to include geocoded addresses
    console.log('Processing shift details with locations');
    const processedShiftDetails = [];
    for (const shift of shiftDetailsResult.rows) {
      try {
        // Debug logging to see what's coming from the database
        if (shift.id === shiftDetailsResult.rows[0]?.id) {
          console.log('Sample location data format:', { 
            location_start: shift.location_start,
            location_end: shift.location_end,
            type_start: typeof shift.location_start,
            type_end: typeof shift.location_end
          });
        }
        
        // Handle null/undefined values with fallbacks
        let startLocation = 'N/A';
        let endLocation = 'N/A';
        
        // Only try to geocode if we have data
        if (shift.location_start) {
          startLocation = await reverseGeocode(shift.location_start);
        }
        
        if (shift.location_end) {
          endLocation = await reverseGeocode(shift.location_end);
        }
        
        processedShiftDetails.push({
          ...shift,
          start_location: startLocation,
          end_location: endLocation
        });
      } catch (error) {
        console.error('Error processing location for shift:', shift.shift_id, error);
        // Add the shift with default N/A locations to avoid losing data
        processedShiftDetails.push({
          ...shift,
          start_location: 'N/A',
          end_location: 'N/A'
        });
      }
    }
    
    // Get expense data for this employee in the period
    const expenseDetailsResult = await client.query(`
      SELECT 
        e.id,
        DATE(e.date) as date,
        e.total_amount,
        e.total_kilometers,
        e.lodging_expenses,
        e.daily_allowance,
        e.diesel,
        e.toll_charges,
        e.other_expenses,
        e.status,
        e.comments
      FROM expenses e
      WHERE e.user_id = $1
      AND DATE(e.date) >= $2::date
      AND DATE(e.date) <= $3::date
      ORDER BY e.date`,
      [employeeId, startDateStr, endDateStr]
    );
    
    // Get leave data for this employee
    const employeeLeaves = leaveInfoResult.rows.filter(
      leave => leave.employee_id === employeeId
    );
    
    // Create a map of dates to leave status for this employee
    const employeeLeaveDates: Record<string, any> = {};
    for (const leave of employeeLeaves) {
      try {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        
        if (isNaN(leaveStart.getTime()) || isNaN(leaveEnd.getTime())) {
          console.error('Invalid leave date', { 
            employeeId, 
            startDate: leave.start_date, 
            endDate: leave.end_date 
          });
          continue;
        }
        
        let currentLeaveDate = new Date(leaveStart);
        while (currentLeaveDate <= leaveEnd) {
          const dateKey = currentLeaveDate.toISOString().split('T')[0];
          employeeLeaveDates[dateKey] = {
            leaveType: leave.leave_type,
            isPaid: leave.is_paid,
            status: leave.leave_status,
            reason: leave.reason || ''
          };
          currentLeaveDate.setDate(currentLeaveDate.getDate() + 1);
        }
      } catch (err) {
        console.error('Error processing leave dates', err);
      }
    }
    
    // Map shifts and expenses to dates
    const shiftsMap: Record<string, any[]> = {};
    for (const shift of processedShiftDetails) {
      try {
        const dateKey = new Date(shift.date).toISOString().split('T')[0];
        if (!shiftsMap[dateKey]) {
          shiftsMap[dateKey] = [];
        }
        shiftsMap[dateKey].push({
          id: shift.shift_id,
          startTime: shift.start_time,
          endTime: shift.end_time || 'N/A',
          duration: parseFloat(shift.duration || '0'),
          distance: parseFloat(shift.distance || '0'),
          expenses: parseFloat(shift.expenses || '0'),
          status: shift.status,
          startLocation: shift.start_location || 'N/A',
          endLocation: shift.end_location || 'N/A',
          endedAutomatically: shift.ended_automatically || false
        });
      } catch (err) {
        console.error('Error processing shift', err);
      }
    }
    
    const expensesMap: Record<string, any[]> = {};
    for (const expense of expenseDetailsResult.rows) {
      try {
        const dateKey = new Date(expense.date).toISOString().split('T')[0];
        if (!expensesMap[dateKey]) {
          expensesMap[dateKey] = [];
        }
        expensesMap[dateKey].push({
          id: expense.id,
          total: parseFloat(expense.total_amount || '0'),
          kilometers: parseFloat(expense.total_kilometers || '0'),
          lodging: parseFloat(expense.lodging_expenses || '0'),
          dailyAllowance: parseFloat(expense.daily_allowance || '0'),
          fuel: parseFloat(expense.diesel || '0'),
          toll: parseFloat(expense.toll_charges || '0'),
          other: parseFloat(expense.other_expenses || '0'),
          status: expense.status || 'pending',
          comments: expense.comments || ''
        });
      } catch (err) {
        console.error('Error processing expense', err);
      }
    }
    
    // Create comprehensive daily records for the employee
    const dailyRecords = dateRange.map(date => {
      try {
        const dateKey = date.toISOString().split('T')[0];
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
        const formattedDate = date.toLocaleDateString();
        
        const shifts = shiftsMap[dateKey] || [];
        const expenses = expensesMap[dateKey] || [];
        const leaveInfo = employeeLeaveDates[dateKey];
        
        const totalHours = shifts.reduce((sum, shift) => sum + shift.duration, 0);
        const totalDistance = shifts.reduce((sum, shift) => sum + shift.distance, 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.total, 0);

      return {
          date: formattedDate,
          dayOfWeek,
          status: leaveInfo ? 'leave' : (shifts.length > 0 ? 'present' : 'absent'),
          shifts,
          expenses,
          leave: leaveInfo,
          summary: {
            totalHours,
            totalDistance,
            totalExpenses,
            shiftsCount: shifts.length
          }
        };
      } catch (err) {
        console.error('Error creating daily record', err);
        // Return a fallback daily record with minimal data
        return {
          date: date.toLocaleDateString(),
          dayOfWeek: 'N/A',
          status: 'unknown',
          shifts: [],
          expenses: [],
          summary: {
            totalHours: 0,
            totalDistance: 0,
            totalExpenses: 0,
            shiftsCount: 0
          }
        };
      }
    });
    
    // Add employee data to the full dataset
    employeeAttendanceData[employeeId] = {
      id: employeeId,
      name: employee.employee_name,
      employeeNumber: employee.employee_number || 'N/A',
      department: employee.department || 'N/A',
      designation: employee.designation || 'N/A',
      summary: {
        daysPresent: parseInt(employee.days_present || '0'),
        daysAbsent: dateRange.length - parseInt(employee.days_present || '0') - 
                   Object.keys(employeeLeaveDates).length,
        daysOnLeave: Object.keys(employeeLeaveDates).length,
        avgHours: parseFloat(employee.avg_hours || '0'),
        onTimePercentage: parseFloat(employee.on_time_percentage || '0'),
        totalDistance: parseFloat(employee.total_distance || '0'),
        totalExpenses: parseFloat(employee.total_expenses || '0'),
        completedShifts: parseInt(employee.completed_shifts || '0'),
        activeShifts: parseInt(employee.active_shifts || '0'),
        incompleteShifts: parseInt(employee.incomplete_shifts || '0'),
      },
      dailyRecords: dailyRecords
    };
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
      totalWorkingHours: parseFloat(summaryData.total_working_hours || '0'),
      reportPeriod: {
        startDate: startDateStr,
        endDate: endDateStr,
        totalDays: dateRange.length
      }
    },
    dailyStats: dailyStatsResult.rows.map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
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
      employeeNumber: row.employee_number || 'N/A',
      role: row.role || 'Employee',
      department: row.department || 'N/A',
      designation: row.designation || 'N/A',
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
    leaveInfo: leaveInfoResult.rows.map(row => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeNumber: row.employee_number || 'N/A',
      startDate: row.start_date.toISOString().split('T')[0],
      endDate: row.end_date.toISOString().split('T')[0],
      daysCount: parseFloat(row.days_count || '0'),
      leaveType: row.leave_type,
      isPaid: row.is_paid,
      reason: row.reason
    })),
    // Add the comprehensive employee attendance data
    employeeAttendanceData: Object.values(employeeAttendanceData)
  };
}

async function getTaskReportData(client: PoolClient, adminId: number, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Format dates for queries
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
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
  params.push(startDateStr, endDateStr);
  const dateParamIndex = paramIndex;
  
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
    params
  );
  
  // Get status breakdown
  const statusResult = await client.query(`
    WITH status_counts AS (
      SELECT 
        et.status,
        COUNT(*) as count
      FROM employee_tasks et
      JOIN users u ON et.assigned_to = u.id
      WHERE et.assigned_by = $1
      ${employeeFilter}
      ${departmentFilter}
      AND et.created_at >= $${dateParamIndex}::date
      AND et.created_at <= $${dateParamIndex + 1}::date
      GROUP BY et.status
    ),
    total AS (
      SELECT SUM(count) as total FROM status_counts
    )
    SELECT 
      s.status,
      s.count,
      ROUND((s.count::float * 100 / NULLIF(t.total, 0))::numeric, 1) as percentage
    FROM status_counts s
    CROSS JOIN total t
    ORDER BY s.count DESC`,
    params
  );
  
  // Get priority breakdown
  const priorityResult = await client.query(`
    WITH priority_counts AS (
      SELECT 
        et.priority,
        COUNT(*) as count
      FROM employee_tasks et
      JOIN users u ON et.assigned_to = u.id
      WHERE et.assigned_by = $1
      ${employeeFilter}
      ${departmentFilter}
      AND et.created_at >= $${dateParamIndex}::date
      AND et.created_at <= $${dateParamIndex + 1}::date
      GROUP BY et.priority
    ),
    total AS (
      SELECT SUM(count) as total FROM priority_counts
    )
    SELECT 
      p.priority,
      p.count,
      ROUND((p.count::float * 100 / NULLIF(t.total, 0))::numeric, 1) as percentage
    FROM priority_counts p
    CROSS JOIN total t
    ORDER BY p.count DESC`,
    params
  );
  
  // Get employee performance
  const employeeResult = await client.query(`
    WITH employee_stats AS (
      SELECT 
        u.id,
        u.name as employee_name,
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN et.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE 
          WHEN et.status = 'completed' 
          AND et.due_date >= et.last_status_update
          THEN 1 END) as on_time_tasks,
        AVG(
          CASE WHEN et.status = 'completed' AND et.last_status_update IS NOT NULL
          THEN EXTRACT(EPOCH FROM (et.last_status_update - et.created_at))/3600 
          END
        ) as avg_completion_time
      FROM employee_tasks et
      JOIN users u ON et.assigned_to = u.id
      WHERE et.assigned_by = $1
      ${departmentFilter}
      AND et.created_at >= $${dateParamIndex}::date
      AND et.created_at <= $${dateParamIndex + 1}::date
      GROUP BY u.id, u.name
    )
    SELECT 
      employee_name,
      total_tasks,
      completed_tasks,
      ROUND((on_time_tasks::float * 100 / NULLIF(completed_tasks, 0))::numeric, 1) as on_time_completion,
      ROUND(avg_completion_time::numeric, 1) as avg_completion_time
    FROM employee_stats
    ORDER BY total_tasks DESC`,
    params
  );
  
  const totalTasks = parseInt(summaryResult.rows[0]?.total_tasks || '0');
  const completedTasks = parseInt(summaryResult.rows[0]?.completed_tasks || '0');
  
  return {
    summary: {
      totalTasks,
      completedTasks,
      overdueTasks: parseInt(summaryResult.rows[0]?.overdue_tasks || '0'),
      avgCompletionTime: parseFloat(summaryResult.rows[0]?.avg_completion_time || '0'),
      completionRate: parseFloat(summaryResult.rows[0]?.completion_rate || '0')
    },
    statusBreakdown: statusResult.rows.map(row => ({
      status: row.status || 'Unknown',
      count: parseInt(row.count),
      percentage: row.percentage
    })),
    priorityBreakdown: priorityResult.rows.map(row => ({
      priority: row.priority || 'Unknown',
      count: parseInt(row.count),
      percentage: row.percentage
    })),
    employeePerformance: employeeResult.rows.map(row => ({
      employeeName: row.employee_name,
      totalTasks: parseInt(row.total_tasks),
      completedTasks: parseInt(row.completed_tasks),
      onTimeCompletion: parseFloat(row.on_time_completion || '0'),
      avgCompletionTime: parseFloat(row.avg_completion_time || '0')
    }))
  };
}

async function getTravelReportData(client: PoolClient, adminId: number, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Format dates for queries
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
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
  params.push(startDateStr, endDateStr);
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
    params
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
    params
  );
  
  // Get transport types breakdown
  const transportResult = await client.query(`
    SELECT 
      COALESCE(vehicle_type, 'Unspecified') as vehicle_type,
      COUNT(*) as trip_count,
      ROUND(SUM(total_kilometers)::numeric, 2) as total_distance,
      ROUND(SUM(total_amount)::numeric, 2) as total_expenses
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.group_admin_id = $1
    ${employeeFilter}
    ${departmentFilter}
    AND e.date >= $${dateParamIndex}::date
    AND e.date <= $${dateParamIndex + 1}::date
    GROUP BY vehicle_type
    ORDER BY trip_count DESC`,
    params
  );
  
  // Get employee statistics
  const employeeStatsResult = await client.query(`
    SELECT 
      u.name as employee_name,
      COUNT(*) as trip_count,
      ROUND(SUM(e.total_kilometers)::numeric, 2) as total_distance,
      ROUND(SUM(e.total_amount)::numeric, 2) as total_expenses,
      ROUND(AVG(e.total_amount)::numeric, 2) as avg_expense_per_trip
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.group_admin_id = $1
    ${departmentFilter}
    AND e.date >= $${dateParamIndex}::date
    AND e.date <= $${dateParamIndex + 1}::date
    GROUP BY u.name
    ORDER BY trip_count DESC`,
    params
  );
  
  // Get recent trips
  const recentTripsResult = await client.query(`
    SELECT 
      u.name as employee_name,
      e.date,
      COALESCE(e.comments, 'Travel expense') as description,
      e.total_kilometers as distance,
      e.total_amount as expenses
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.group_admin_id = $1
    ${employeeFilter}
    ${departmentFilter}
    AND e.date >= $${dateParamIndex}::date
    AND e.date <= $${dateParamIndex + 1}::date
    ORDER BY e.date DESC
    LIMIT 10`,
    params
  );

  // Calculate total expenses for percentages
  const total = categoryResult.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);

  // Format data to match TravelTemplate expectations
  const expenseBreakdown = categoryResult.rows.map(row => ({
    category: row.category,
    amount: parseFloat(row.amount),
    percentage: parseFloat(((parseFloat(row.amount) / (total || 1)) * 100).toFixed(1))
  }));
  
  const vehicleStats = transportResult.rows.map(row => ({
    vehicleType: row.vehicle_type,
    tripCount: parseInt(row.trip_count),
    totalDistance: parseFloat(row.total_distance),
    totalExpenses: parseFloat(row.total_expenses)
  }));
  
  const employeeStats = employeeStatsResult.rows.map(row => ({
    employeeName: row.employee_name,
    tripCount: parseInt(row.trip_count),
    totalDistance: parseFloat(row.total_distance),
    totalExpenses: parseFloat(row.total_expenses),
    avgExpensePerTrip: parseFloat(row.avg_expense_per_trip)
  }));
  
  const recentTrips = recentTripsResult.rows.map(row => ({
    employeeName: row.employee_name,
    date: new Date(row.date).toLocaleDateString(),
    route: row.description,
    distance: parseFloat(row.distance),
    expenses: parseFloat(row.expenses)
  }));

  return {
    summary: {
      totalTravelers: parseInt(summaryResult.rows[0]?.total_travelers || '0'),
      totalTrips: parseInt(summaryResult.rows[0]?.total_trips || '0'),
      totalDistance: parseFloat(summaryResult.rows[0]?.total_distance || '0'),
      totalExpenses: parseFloat(summaryResult.rows[0]?.total_expenses || '0'),
      avgTripCost: parseFloat(summaryResult.rows[0]?.avg_trip_cost || '0')
    },
    expenseBreakdown,
    vehicleStats,
    employeeStats,
    recentTrips: recentTrips.length > 0 ? recentTrips : [],
    categories: categoryResult.rows.map(row => ({
      category: row.category,
      amount: parseFloat(row.amount),
      percentage: total > 0 ? ((parseFloat(row.amount) / total) * 100).toFixed(1) : '0'
    }))
  };
}

async function getPerformanceReportData(client: PoolClient, adminId: number, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Format dates for queries
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
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
  params.push(startDateStr, endDateStr);
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
    params
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

async function getLeaveReportData(client: PoolClient, adminId: number, filters: FilterOptions = {}) {
  const { startDate, endDate } = processDateFilters(filters.startDate, filters.endDate);
  
  // Format dates for queries
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
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
  params.push(startDateStr, endDateStr);
  const dateParamIndex = paramIndex;
  
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
    params
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