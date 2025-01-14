import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken, adminMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

// Group Admin: Create task
router.post('/', verifyToken, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { 
      title, 
      description, 
      assignedTo, 
      priority, 
      dueDate 
    } = req.body;

    const result = await client.query(
      `INSERT INTO employee_tasks (
        title, description, assigned_to, assigned_by, priority, due_date
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
      [title, description, assignedTo, req.user?.id, priority, dueDate]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  } finally {
    client.release();
  }
});

// Employee: Update task status
router.patch('/:taskId/status', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    // Get current task
    const currentTask = await client.query(
      'SELECT status_history FROM employee_tasks WHERE id = $1 AND assigned_to = $2',
      [taskId, req.user?.id]
    );

    if (currentTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update status history
    const statusHistory = currentTask.rows[0].status_history || [];
    statusHistory.push({
      status,
      updatedAt: new Date(),
      updatedBy: req.user?.id
    });

    const result = await client.query(
      `UPDATE employee_tasks 
       SET status = $1, 
           status_history = $2::jsonb,
           last_status_update = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND assigned_to = $4
       RETURNING *`,
      [status, JSON.stringify(statusHistory), taskId, req.user?.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  } finally {
    client.release();
  }
});

// Get tasks for employee
router.get('/employee', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    const result = await client.query(
      `SELECT 
        t.*,
        u.name as assigned_by_name
       FROM employee_tasks t
       LEFT JOIN users u ON t.assigned_by = u.id
       WHERE t.assigned_to = $1
       AND DATE(t.due_date) = $2
       ORDER BY 
         CASE t.priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
         END,
         t.created_at DESC`,
      [req.user?.id, today]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  } finally {
    client.release();
  }
});

// Group Admin: Get all tasks
router.get('/admin', verifyToken, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        t.id,
        t.title,
        t.description,
        t.assigned_to,
        t.assigned_by,
        t.priority,
        t.status,
        TO_CHAR(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
        t.status_history,
        u1.name as employee_name,
        u1.employee_number,
        u2.name as assigned_by_name
      FROM employee_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      WHERE t.assigned_by = $1
      ORDER BY t.created_at DESC`,
      [req.user?.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  } finally {
    client.release();
  }
});

export default router; 