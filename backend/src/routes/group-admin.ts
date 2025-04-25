import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { format } from 'date-fns';

type ParsedCSV = string[][];
interface CSVHeaders {
  [key: string]: number;
}

const upload = multer();
const router = express.Router();

// Add this helper function at the top
const convertToLocalTime = (isoString: string) => {
  return isoString.replace(/Z$/, '');  // Remove Z suffix to treat as local time
};

// Get employees for a group admin
router.get('/employees', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const result = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.employee_number,
        u.department,
        u.designation,
        u.created_at,
        u.can_submit_expenses_anytime,
        u.shift_status
      FROM users u
      WHERE u.group_admin_id = $1
      AND u.role = 'employee'
      ORDER BY u.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  } finally {
    client.release();
  }
});

// Create single employee
router.post('/employees', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const { 
      name, 
      employeeNumber, 
      email, 
      phone, 
      password, 
      department, 
      designation,
      gender,
      can_submit_expenses_anytime 
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !employeeNumber || !department || !gender) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        errors: {
          name: !name ? 'Name is required' : null,
          employeeNumber: !employeeNumber ? 'Employee number is required' : null,
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null,
          department: !department ? 'Department is required' : null,
          gender: !gender ? 'Gender is required' : null
        }
      });
    }

    // Validate gender value
    const validGenders = ['male', 'female', 'other'];
    if (!validGenders.includes(gender.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid gender value',
        errors: {
          gender: 'Gender must be male, female, or other'
        }
      });
    }

    await client.query('BEGIN');

    // Get group admin's company_id and management_id
    const groupAdminResult = await client.query(
      'SELECT company_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!groupAdminResult.rows.length || !groupAdminResult.rows[0].company_id) {
      throw new Error('Group admin company not found');
    }

    const company_id = groupAdminResult.rows[0].company_id;

    // Check user limit before proceeding
    const userLimitCheck = await checkUserLimit(client, company_id);
    if (!userLimitCheck.canAddUsers) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'User limit reached',
        details: {
          message: `Cannot create new employee. Your company has reached its user limit.`,
          currentCount: userLimitCheck.currentUserCount,
          userLimit: userLimitCheck.userLimit
        }
      });
    }

    // Get management_id for the company
    const managementResult = await client.query(
      'SELECT id FROM users WHERE company_id = $1 AND role = $2',
      [company_id, 'management']
    );

    if (!managementResult.rows.length) {
      throw new Error('Management user not found for company');
    }

    const management_id = managementResult.rows[0].id;

    // Check if email or employee number exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 OR employee_number = $2',
      [email, employeeNumber]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Email or Employee Number already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create employee
    const result = await client.query(
      `INSERT INTO users (
        name, 
        employee_number,
        email, 
        phone, 
        password, 
        role, 
        department,
        designation,
        gender,
        group_admin_id,
        company_id,
        management_id,
        can_submit_expenses_anytime
      ) VALUES ($1, $2, $3, $4, $5, 'employee', $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, name, employee_number, email, phone, department, designation, gender, created_at, can_submit_expenses_anytime`,
      [
        name,
        employeeNumber,
        email,
        phone || null,
        hashedPassword,
        department,
        designation || null,
        gender.toLowerCase(),
        req.user.id,
        company_id,
        management_id,
        can_submit_expenses_anytime || false
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  } finally {
    client.release();
  }
});

// Bulk create employees from CSV
router.post('/employees/bulk', verifyToken, upload.single('file'), async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await client.query('BEGIN');

    // Get group admin's company_id
    const groupAdminResult = await client.query(
      'SELECT company_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!groupAdminResult.rows.length || !groupAdminResult.rows[0].company_id) {
      throw new Error('Group admin company not found');
    }

    const company_id = groupAdminResult.rows[0].company_id;

    // Get management_id for the company
    const managementResult = await client.query(
      'SELECT id FROM users WHERE company_id = $1 AND role = $2',
      [company_id, 'management']
    );

    if (!managementResult.rows.length) {
      throw new Error('Management user not found for company');
    }

    const management_id = managementResult.rows[0].id;

    const fileContent = req.file.buffer.toString();
    const parsedRows: ParsedCSV = parse(fileContent, {
      skip_empty_lines: true,
      trim: true
    });

    if (parsedRows.length < 2) {
      return res.status(400).json({ error: 'File is empty or missing headers' });
    }

    // Check user limit before processing CSV
    const validRowCount = parsedRows.length - 1; // Subtract header row
    const userLimitCheck = await checkUserLimit(client, company_id, validRowCount);
    if (!userLimitCheck.canAddUsers) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'User limit exceeded',
        details: {
          message: `Cannot create new employees. Your company has reached its user limit.`,
          currentCount: userLimitCheck.currentUserCount,
          userLimit: userLimitCheck.userLimit,
          remainingSlots: userLimitCheck.remainingSlots,
          attemptedToAdd: validRowCount
        }
      });
    }

    const headerRow = parsedRows[0];
    const headers: CSVHeaders = {};
    headerRow.forEach((header: string, index: number) => {
      headers[header.toLowerCase()] = index;
    });

    // Validate required headers
    const requiredHeaders = ['name', 'employee_number', 'email', 'password', 'department', 'gender'];
    const missingHeaders = requiredHeaders.filter(header => !headers.hasOwnProperty(header));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: 'Missing required columns',
        details: `Missing columns: ${missingHeaders.join(', ')}`
      });
    }

    const results = [];
    const errors = [];
    const validGenders = ['male', 'female', 'other'];
    const uniqueEmails = new Set();
    const uniqueEmployeeNumbers = new Set();
    const uniquePhones = new Set();

    // First pass: validate all rows and check for duplicates within the CSV
    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const email = row[headers['email']]?.trim();
      const employeeNumber = row[headers['employee_number']]?.trim();
      const phone = row[headers['phone']]?.trim();

      if (email && uniqueEmails.has(email)) {
        errors.push({
          row: i + 1,
          error: 'Duplicate email within CSV file',
          email
        });
        continue;
      }

      if (employeeNumber && uniqueEmployeeNumbers.has(employeeNumber)) {
        errors.push({
          row: i + 1,
          error: 'Duplicate employee number within CSV file',
          email
        });
        continue;
      }

      if (phone) {
        if (uniquePhones.has(phone)) {
          errors.push({
            row: i + 1,
            error: 'Duplicate phone number within CSV file',
            email
          });
          continue;
        }
        // Validate phone number format
        const phoneRegex = /^\+?[1-9]\d{9,14}$/;
        if (!phoneRegex.test(phone)) {
          errors.push({
            row: i + 1,
            error: 'Invalid phone number format. Must be 10-15 digits with optional + prefix',
            email
          });
          continue;
        }
      }

      uniqueEmails.add(email);
      uniqueEmployeeNumbers.add(employeeNumber);
      if (phone) uniquePhones.add(phone);
    }

    // If there are validation errors, return them immediately
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation errors in CSV file',
        errors
      });
    }

    // Second pass: process each row
    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        const employee = {
          name: row[headers['name']]?.trim(),
          employee_number: row[headers['employee_number']]?.trim(),
          email: row[headers['email']]?.trim(),
          phone: row[headers['phone']]?.trim(),
          password: row[headers['password']]?.trim(),
          department: row[headers['department']]?.trim(),
          designation: row[headers['designation']]?.trim(),
          gender: row[headers['gender']]?.trim().toLowerCase(),
          can_submit_expenses_anytime: row[headers['can_submit_expenses_anytime']]?.toLowerCase() === 'true'
        };

        // Validate required fields
        if (!employee.name || !employee.employee_number || !employee.email || 
            !employee.password || !employee.department || !employee.gender) {
          errors.push({ 
            row: i + 1, 
            error: 'Missing required fields',
            email: employee.email
          });
          continue;
        }

        // Validate gender
        if (!validGenders.includes(employee.gender)) {
          errors.push({ 
            row: i + 1, 
            error: 'Invalid gender value. Must be male, female, or other',
            email: employee.email
          });
          continue;
        }

        // Check for existing user in database
        const existingUser = await client.query(
          'SELECT id, email, employee_number, phone FROM users WHERE email = $1 OR employee_number = $2 OR (phone = $3 AND $3 IS NOT NULL)',
          [employee.email, employee.employee_number, employee.phone]
        );

        if (existingUser.rows.length > 0) {
          const existing = existingUser.rows[0];
          let duplicateField = '';
          if (existing.email === employee.email) duplicateField = 'email';
          else if (existing.employee_number === employee.employee_number) duplicateField = 'employee number';
          else if (existing.phone === employee.phone) duplicateField = 'phone number';

          errors.push({ 
            row: i + 1, 
            error: `Duplicate ${duplicateField} already exists in the system`,
            email: employee.email
          });
          continue;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(employee.password, salt);

        const result = await client.query(
          `INSERT INTO users (
            name, 
            employee_number,
            email, 
            phone, 
            password, 
            role, 
            department,
            designation,
            gender,
            group_admin_id,
            company_id,
            management_id,
            can_submit_expenses_anytime
          ) VALUES ($1, $2, $3, $4, $5, 'employee', $6, $7, $8, $9, $10, $11, $12)
          RETURNING id, name, employee_number, email`,
          [
            employee.name,
            employee.employee_number,
            employee.email,
            employee.phone || null,
            hashedPassword,
            employee.department,
            employee.designation || null,
            employee.gender,
            req.user.id,
            company_id,
            management_id,
            employee.can_submit_expenses_anytime
          ]
        );

        results.push(result.rows[0]);
      } catch (error: any) {
        console.error(`Error processing row ${i + 1}:`, error);
        let errorMessage = 'Failed to create employee';
        
        // Handle specific database errors
        if (error.code === '23505') { // Unique violation
          const field = error.constraint.replace('users_', '').replace('_key', '');
          errorMessage = `Duplicate ${field} already exists in the system`;
        }
        
        errors.push({ 
          row: i + 1, 
          error: errorMessage,
          email: row[headers['email']]?.trim()
        });
      }
    }

    if (results.length > 0) {
      await client.query('COMMIT');
      res.status(201).json({ 
        success: results, 
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          total: parsedRows.length - 1,
          success: results.length,
          failed: errors.length
        }
      });
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ 
        error: 'No employees were created',
        errors,
        summary: {
          total: parsedRows.length - 1,
          success: 0,
          failed: errors.length
        }
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk create:', error);
    res.status(500).json({ error: 'Failed to process bulk creation' });
  } finally {
    client.release();
  }
});

// Update employee access permission
router.patch('/employees/:id/access', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const { id } = req.params;
    const { can_submit_expenses_anytime } = req.body;

    const result = await client.query(
      `UPDATE users 
       SET can_submit_expenses_anytime = $1
       WHERE id = $2 AND group_admin_id = $3 AND role = 'employee'
       RETURNING id, name, email, can_submit_expenses_anytime`,
      [can_submit_expenses_anytime, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee access:', error);
    res.status(500).json({ error: 'Failed to update employee access' });
  } finally {
    client.release();
  }
});

// Delete employee
router.delete('/employees/:id', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const { id } = req.params;

    await client.query('BEGIN');

    const result = await client.query(
      'DELETE FROM users WHERE id = $1 AND group_admin_id = $2 AND role = \'employee\' RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Employee not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  } finally {
    client.release();
  }
});

// Get group admin profile with group details
router.get('/profile', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const result = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.created_at,
        c.name as company_name,
        (
          SELECT COUNT(*) 
          FROM users e 
          WHERE e.group_admin_id = u.id AND e.role = 'employee'
        ) as total_employees,
        (
          SELECT COUNT(*) 
          FROM users e 
          WHERE e.group_admin_id = u.id 
          AND e.role = 'employee'
          AND e.status = 'active'
        ) as active_employees
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  } finally {
    client.release();
  }
});

// Update group admin profile
router.put('/profile', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const { name, phone } = req.body;

    const result = await client.query(
      `UPDATE users 
       SET 
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, name, email, phone`,
      [name, phone, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  } finally {
    client.release();
  }
});

// Change password endpoint
router.post('/change-password', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const userResult = await client.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );

    const validPassword = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password
    );

    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await client.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  } finally {
    client.release();
  }
});

// Add this new endpoint for recent activities
router.get('/recent-activities', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get recent activities from different tables
    const result = await client.query(`
      (
        -- Employee activities
        SELECT 
          'Employee Added' as type,
          name,
          created_at as time
        FROM users 
        WHERE group_admin_id = $1 
        AND role = 'employee'
        
        UNION ALL
        
        -- Task activities
        SELECT 
          'Task Created' as type,
          title as name,
          created_at as time
        FROM employee_tasks 
        WHERE assigned_by = $1
        
        UNION ALL
        
        -- Expense activities
        SELECT 
          'Expense ' || CASE 
            WHEN status = 'approved' THEN 'Approved'
            WHEN status = 'rejected' THEN 'Rejected'
            ELSE 'Updated'
          END as type,
          employee_name as name,
          updated_at as time
        FROM expenses 
        WHERE group_admin_id = $1
      )
      ORDER BY time DESC
      LIMIT 5
    `, [req.user.id]);

    // Format the response
    const activities = result.rows.map(activity => ({
      type: activity.type,
      name: activity.name,
      time: formatActivityTime(activity.time)
    }));

    res.json(activities);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({ error: 'Failed to fetch recent activities' });
  } finally {
    client.release();
  }
});

// Helper function to format time
function formatActivityTime(timestamp: Date): string {
  const now = new Date();
  const activityTime = new Date(timestamp);
  const diffInHours = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));
    return `${diffInMinutes} minutes ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else {
    return format(activityTime, 'MMM dd, yyyy');
  }
}

// Start a new shift Group-Admin
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
      `INSERT INTO group_admin_shifts (user_id, start_time, status)
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
       FROM group_admin_shifts 
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
      `UPDATE group_admin_shifts 
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
        FROM group_admin_shifts
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
        FROM group_admin_shifts
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
      FROM group_admin_shifts
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

// Helper function to check user limit
async function checkUserLimit(client: any, companyId: number, newUsersCount: number = 1) {
  // Get company details including user limit
  const companyResult = await client.query(
    `SELECT name, user_limit FROM companies WHERE id = $1`,
    [companyId]
  );

  if (!companyResult.rows.length) {
    throw new Error('Company not found');
  }

  const company = companyResult.rows[0];

  // Get current user count for the company (excluding management users)
  const userCountResult = await client.query(
    `SELECT COUNT(*) as count FROM users 
     WHERE company_id = $1 AND role IN ('group-admin', 'employee')`,
    [companyId]
  );

  const currentUserCount = parseInt(userCountResult.rows[0].count);
  const userLimit = parseInt(company.user_limit);

  return {
    canAddUsers: currentUserCount + newUsersCount <= userLimit,
    currentUserCount,
    userLimit,
    companyName: company.name,
    remainingSlots: userLimit - currentUserCount
  };
}

// Get employee expense permissions
router.get('/employee-expense-permissions', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const result = await client.query(
      `SELECT 
        u.id as user_id,
        u.name as user_name,
        u.employee_number,
        u.department,
        u.designation,
        u.can_submit_expenses_anytime
       FROM users u
       WHERE u.group_admin_id = $1 AND u.role = 'employee'
       ORDER BY u.name ASC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expense permissions:', error);
    res.status(500).json({ error: 'Failed to fetch expense permissions' });
  } finally {
    client.release();
  }
});

// Update employee expense permission
router.put('/employee-expense-permissions/:userId', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const { userId } = req.params;
    const { can_submit_expenses_anytime } = req.body;

    // Verify the employee belongs to this group admin
    const result = await client.query(
      `UPDATE users 
       SET 
         can_submit_expenses_anytime = $1,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND group_admin_id = $3 AND role = 'employee'
       RETURNING id, name, employee_number, can_submit_expenses_anytime`,
      [can_submit_expenses_anytime, userId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found or unauthorized' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense permission:', error);
    res.status(500).json({ error: 'Failed to update expense permission' });
  } finally {
    client.release();
  }
});

export default router; 