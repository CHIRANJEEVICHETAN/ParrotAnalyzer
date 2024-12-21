import express, { Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { verifyToken, requireSuperAdmin } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

// Get all companies
router.get('/', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.status,
        c.created_at,
        (
          SELECT json_build_object(
            'name', u.name,
            'email', u.email,
            'phone', u.phone
          )
          FROM users u 
          WHERE u.company_id = c.id AND u.role = 'management'
          LIMIT 1
        ) as management,
        (
          SELECT COUNT(*) 
          FROM users 
          WHERE company_id = c.id AND role != 'management'
        ) as user_count
      FROM companies c
      ORDER BY c.name
    `);
    
    const companies = result.rows.map(company => ({
      ...company,
      management: company.management || null,
      user_count: parseInt(company.user_count) || 0
    }));

    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Create new company with management account
router.post('/', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { 
      companyName, 
      companyEmail, 
      companyAddress, 
      managementName, 
      managementEmail, 
      managementPhone, 
      managementPassword 
    } = req.body;

    if (!companyName || !companyEmail || !managementName || !managementEmail || !managementPassword) {
      return res.status(400).json({ 
        error: 'Missing required fields'
      });
    }

    await client.query('BEGIN');
    
    const existingCompany = await client.query(
      'SELECT id FROM companies WHERE email = $1',
      [companyEmail]
    );

    if (existingCompany.rows.length > 0) {
      throw new Error('Company with this email already exists');
    }

    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [managementEmail]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Management email already exists');
    }

    const companyResult = await client.query(
      `INSERT INTO companies (name, email, address, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [companyName, companyEmail, companyAddress]
    );

    const companyId = companyResult.rows[0].id;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(managementPassword, salt);

    await client.query(
      `INSERT INTO users (name, email, phone, password, role, company_id)
       VALUES ($1, $2, $3, $4, 'management', $5)`,
      [managementName, managementEmail, managementPhone, hashedPassword, companyId]
    );

    await client.query('COMMIT');
    res.status(201).json({ 
      message: 'Company created successfully',
      companyId: companyId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  } finally {
    client.release();
  }
});

// Toggle company status
router.patch('/:id/toggle-status', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      `UPDATE companies 
       SET status = CASE WHEN status = 'active' THEN 'disabled' ELSE 'active' END
       WHERE id = $1
       RETURNING status`,
      [req.params.id]
    );
    
    const newStatus = result.rows[0].status;

    await client.query('COMMIT');
    res.json({ 
      message: 'Company status updated successfully',
      status: newStatus
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating company status:', error);
    res.status(500).json({ error: 'Failed to update company status' });
  } finally {
    client.release();
  }
});

// Delete company
router.delete('/:id', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // First check if company exists
    const companyCheck = await client.query(
      'SELECT id FROM companies WHERE id = $1',
      [id]
    );

    if (companyCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Company not found' });
    }

    // 1. First delete all expense documents
    await client.query(`
      DELETE FROM expense_documents 
      WHERE expense_id IN (
        SELECT e.id FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE u.company_id = $1
      )
    `, [id]);

    // 2. Delete all expenses
    await client.query(`
      DELETE FROM expenses 
      WHERE user_id IN (
        SELECT id FROM users WHERE company_id = $1
      )
    `, [id]);

    // 3. Delete all schedule entries
    await client.query(`
      DELETE FROM schedule 
      WHERE user_id IN (
        SELECT id FROM users WHERE company_id = $1
      )
    `, [id]);

    // 4. First update group_admin_id to null for all employees
    await client.query(`
      UPDATE users 
      SET group_admin_id = NULL 
      WHERE company_id = $1 AND role = 'employee'
    `, [id]);

    // 5. Now we can safely delete all users
    await client.query(`
      DELETE FROM users 
      WHERE company_id = $1
    `, [id]);

    // 6. Finally delete the company
    await client.query('DELETE FROM companies WHERE id = $1', [id]);

    await client.query('COMMIT');
    
    res.json({ 
      success: true,
      message: 'Company and all associated data deleted successfully' 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting company:', error);
    
    // Send more detailed error information
    let errorMessage = 'Failed to delete company';
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get company hierarchy
router.get('/:id/hierarchy', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const companyResult = await client.query(
      `SELECT id, name, email, status
       FROM companies
       WHERE id = $1`,
      [id]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyResult.rows[0];

    // Get all related data
    const [managementResult, groupAdminsResult, employeesResult] = await Promise.all([
      client.query(
        `SELECT id, name, email, phone, created_at
         FROM users
         WHERE company_id = $1 AND role = 'management'`,
        [id]
      ),
      client.query(
        `SELECT 
          ga.id,
          ga.name,
          ga.email,
          ga.phone,
          ga.created_at,
          COUNT(e.id) as employee_count
         FROM users ga
         LEFT JOIN users e ON e.group_admin_id = ga.id AND e.role = 'employee'
         WHERE ga.company_id = $1 AND ga.role = 'group-admin'
         GROUP BY ga.id, ga.name, ga.email, ga.phone, ga.created_at`,
        [id]
      ),
      client.query(
        `SELECT 
          e.id,
          e.name,
          e.email,
          e.phone,
          e.employee_number,
          e.department,
          e.designation,
          e.created_at,
          ga.id as group_admin_id,
          ga.name as group_admin_name
         FROM users e
         JOIN users ga ON e.group_admin_id = ga.id
         WHERE ga.company_id = $1 AND e.role = 'employee'
         ORDER BY ga.name, e.name`,
        [id]
      )
    ]);

    const hierarchy = {
      ...company,
      management: managementResult.rows,
      group_admins: groupAdminsResult.rows.map(admin => ({
        ...admin,
        employees: employeesResult.rows
          .filter(emp => emp.group_admin_id === admin.id)
          .map(emp => ({
            id: emp.id,
            name: emp.name,
            email: emp.email,
            phone: emp.phone,
            employee_number: emp.employee_number,
            department: emp.department,
            designation: emp.designation,
            created_at: emp.created_at
          }))
      }))
    };

    res.json(hierarchy);
  } catch (error) {
    console.error('Error fetching company hierarchy:', error);
    res.status(500).json({ error: 'Failed to fetch company hierarchy' });
  } finally {
    client.release();
  }
});

// Add other company-related routes...

export default router; 