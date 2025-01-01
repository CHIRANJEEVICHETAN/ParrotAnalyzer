import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken, requireSuperAdmin } from '../middleware/auth';
import { CustomRequest } from '../types';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Get all users with company details
router.get('/users', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        c.name as company,
        u.created_at
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.role != 'super-admin'
      ORDER BY u.created_at DESC
    `);

    const users = result.rows.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company || 'N/A',
      status: user.status || 'active'
    }));

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  } finally {
    client.release();
  }
});

// Toggle user status
router.patch('/users/:id/toggle-status', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    // First get current status
    const currentStatus = await client.query(
      'SELECT status FROM users WHERE id = $1',
      [id]
    );

    if (!currentStatus.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newStatus = currentStatus.rows[0].status === 'active' ? 'disabled' : 'active';

    const result = await client.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, status',
      [newStatus, id]
    );

    res.json({
      id: result.rows[0].id,
      status: result.rows[0].status
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  } finally {
    client.release();
  }
});

// Add this route to handle password changes
router.post('/change-password', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new passwords are required' });
    }

    // Get current user's password
    const userResult = await client.query(
      'SELECT password FROM users WHERE id = $1 AND role = $2',
      [req.user?.id, 'super-admin']
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await client.query(
      'UPDATE users SET password = $1 WHERE id = $2 AND role = $3',
      [hashedPassword, req.user?.id, 'super-admin']
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ 
      error: 'Failed to change password',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

export default router; 