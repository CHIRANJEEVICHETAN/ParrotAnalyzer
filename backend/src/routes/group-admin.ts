import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const upload = multer();
const router = express.Router();

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
      can_submit_expenses_anytime 
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !employeeNumber || !department) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        errors: {
          name: !name ? 'Name is required' : null,
          employeeNumber: !employeeNumber ? 'Employee number is required' : null,
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null,
          department: !department ? 'Department is required' : null
        }
      });
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
        group_admin_id,
        company_id, 
        can_submit_expenses_anytime
      ) VALUES ($1, $2, $3, $4, $5, 'employee', $6, $7, $8, $9, $10)
      RETURNING id, name, employee_number, email, phone, department, designation, created_at, can_submit_expenses_anytime`,
      [
        name,
        employeeNumber,
        email,
        phone || null,
        hashedPassword,
        department,
        designation || null,
        req.user.id,
        company_id,
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

    const company_id = groupAdminResult.rows[0].company_id;

    // Parse CSV
    const fileContent = req.file.buffer.toString();
    const parsedRows = parse(fileContent, {
      skip_empty_lines: true,
      trim: true
    });

    const headers: { [key: string]: number } = {};
    parsedRows[0].forEach((header: string, index: number) => {
      headers[header.toLowerCase()] = index;
    });

    const results = [];
    const errors = [];

    // Process each row (skip header)
    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        const employee = {
          name: row[headers['name']]?.trim(),
          email: row[headers['email']]?.trim(),
          phone: row[headers['phone']]?.trim(),
          password: row[headers['password']]?.trim(),
          employee_number: row[headers['employee_number']]?.trim(),
          department: row[headers['department']]?.trim(),
          designation: row[headers['designation']]?.trim(),
          can_submit_expenses_anytime: row[headers['can_submit_expenses_anytime']]?.trim().toLowerCase() === 'true'
        };

        // Validate required fields
        if (!employee.name || !employee.email || !employee.password || !employee.employee_number || !employee.department) {
          errors.push({ row: i + 1, error: 'Missing required fields' });
          continue;
        }

        // Check if email or employee number exists
        const existingUser = await client.query(
          'SELECT id FROM users WHERE email = $1 OR employee_number = $2',
          [employee.email, employee.employee_number]
        );

        if (existingUser.rows.length > 0) {
          errors.push({ row: i + 1, error: 'Email or Employee Number already exists' });
          continue;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(employee.password, salt);

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
            group_admin_id,
            company_id, 
            can_submit_expenses_anytime
          ) VALUES ($1, $2, $3, $4, $5, 'employee', $6, $7, $8, $9, $10)
          RETURNING id, name, employee_number, email, phone, department, designation`,
          [
            employee.name,
            employee.employee_number,
            employee.email,
            employee.phone,
            hashedPassword,
            employee.department,
            employee.designation,
            req.user.id,
            company_id,
            employee.can_submit_expenses_anytime
          ]
        );

        results.push(result.rows[0]);
      } catch (error) {
        errors.push({ row: i + 1, error: 'Failed to create employee' });
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ success: results, errors });
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

export default router; 