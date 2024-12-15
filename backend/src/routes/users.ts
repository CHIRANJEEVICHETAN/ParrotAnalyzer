import express, { Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { verifyToken, requireSuperAdmin } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

// Get user profile
router.get('/profile', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = $1',
      [req.user!.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// Register new user (super admin only)
router.post('/register', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    const validRoles = ['employee', 'group-admin', 'management', 'super-admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, role`,
      [name, email, phone, hashedPassword, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

export default router; 