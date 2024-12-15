import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

router.get('/', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        description, 
        location, 
        TO_CHAR(date, 'YYYY-MM-DD') as date, 
        TO_CHAR(time, 'HH24:MI') as time, 
        user_id 
      FROM schedule 
      WHERE user_id = $1 
      ORDER BY date, time`,
      [req.user!.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

router.post('/', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const { title, description, location, date, time } = req.body;
    
    const result = await pool.query(
      `INSERT INTO schedule (user_id, title, description, location, date, time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user!.id, title, description, location, date, time]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding schedule event:', error);
    res.status(500).json({ error: 'Failed to add event' });
  }
});

export default router; 