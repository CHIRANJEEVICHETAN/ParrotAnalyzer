import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

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

export default router; 