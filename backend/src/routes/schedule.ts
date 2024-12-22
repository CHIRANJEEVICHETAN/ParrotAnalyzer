import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

// Get all schedules for an employee
router.get('/', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        id,
        title,
        description,
        TO_CHAR(date, 'YYYY-MM-DD') as date,
        TO_CHAR(time, 'HH24:MI') as time,
        location,
        user_id,
        created_at
       FROM employee_schedule
       WHERE user_id = $1
       ORDER BY date DESC, time ASC`,
      [req.user?.id]
    );

    console.log('Schedule data from DB:', result.rows); // Debug log
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  } finally {
    client.release();
  }
});

// Add new schedule
router.post('/', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { title, description, date, time, location } = req.body;

    // Validate required fields
    if (!title || !date || !time) {
      return res.status(400).json({ error: 'Title, date, and time are required' });
    }

    const result = await client.query(
      `INSERT INTO employee_schedule (
        user_id,
        title,
        description,
        date,
        time,
        location
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [req.user?.id, title, description, date, time, location]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  } finally {
    client.release();
  }
});

// Update schedule
router.patch('/:id', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { title, description, date, time, location } = req.body;

    // Check if schedule exists and belongs to user
    const existing = await client.query(
      'SELECT id FROM employee_schedule WHERE id = $1 AND user_id = $2',
      [id, req.user?.id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const result = await client.query(
      `UPDATE employee_schedule
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           date = COALESCE($3, date),
           time = COALESCE($4, time),
           location = COALESCE($5, location),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [title, description, date, time, location, id, req.user?.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  } finally {
    client.release();
  }
});

// Delete schedule
router.delete('/:id', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Check if schedule exists and belongs to user
    const existing = await client.query(
      'SELECT id FROM employee_schedule WHERE id = $1 AND user_id = $2',
      [id, req.user?.id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    await client.query(
      'DELETE FROM employee_schedule WHERE id = $1 AND user_id = $2',
      [id, req.user?.id]
    );

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  } finally {
    client.release();
  }
});

// Get schedules by date range
router.get('/range', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const result = await client.query(
      `SELECT 
        id,
        title,
        description,
        date,
        time,
        location,
        created_at
       FROM employee_schedule
       WHERE user_id = $1
       AND date BETWEEN $2 AND $3
       ORDER BY date ASC, time ASC`,
      [req.user?.id, startDate, endDate]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules by range:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  } finally {
    client.release();
  }
});

export default router; 