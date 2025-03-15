import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken, adminMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';
import axios from 'axios';

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

    // Format the due date properly
    const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null;

    console.log('Creating task with data:', {
      title,
      description,
      assignedTo,
      assignedBy: req.user?.id,
      priority,
      dueDate: formattedDueDate
    });

    const result = await client.query(
      `INSERT INTO employee_tasks (
        title, description, assigned_to, assigned_by, priority, due_date
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
      [title, description, assignedTo, req.user?.id, priority, formattedDueDate]
    );

    console.log('Created task:', result.rows[0]);
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
    
    console.log('Fetching tasks for user ID:', req.user?.id);
    console.log('Today\'s date:', today);

    const result = await client.query(
      `SELECT 
        t.*,
        u.name as assigned_by_name,
        TO_CHAR(t.due_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') as formatted_due_date
       FROM employee_tasks t
       LEFT JOIN users u ON t.assigned_by = u.id
       WHERE t.assigned_to = $1
       AND (
         -- Include tasks with today's due_date
         DATE(t.due_date AT TIME ZONE 'UTC') = $2::date
         OR
         -- Include tasks with future due_dates
         DATE(t.due_date AT TIME ZONE 'UTC') > $2::date
         OR
         -- Include tasks with no due_date that were created today
         (t.due_date IS NULL AND DATE(t.created_at AT TIME ZONE 'UTC') = $2::date)
         OR
         -- Include tasks with no due_date that are still pending or in_progress
         (t.due_date IS NULL AND t.status IN ('pending', 'in_progress'))
       )
       ORDER BY 
         -- Show tasks with no due_date first
         CASE WHEN t.due_date IS NULL THEN 0 ELSE 1 END,
         -- Then by priority
         CASE t.priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
         END,
         -- Then by due_date if exists
         t.due_date ASC NULLS LAST,
         -- Finally by creation date
         t.created_at DESC`,
      [req.user?.id, today]
    );

    console.log('Found tasks:', result.rows.length);
    console.log('Tasks:', result.rows.map(task => ({
      id: task.id,
      title: task.title,
      due_date: task.due_date,
      formatted_due_date: task.formatted_due_date,
      created_at: task.created_at,
      status: task.status
    })));

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
    const result = await client.query(
      `SELECT 
        t.*,
        u1.employee_number,
        u1.name as employee_name,
        u2.name as assigned_by_name,
        TO_CHAR(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt"
      FROM employee_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      WHERE t.assigned_by = $1
      ORDER BY t.created_at DESC`,
      [req.user?.id]
    );

    // Format dates in the response
    const formattedTasks = result.rows.map(task => ({
      ...task,
      due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
      // createdAt is already formatted by the query
    }));

    res.json(formattedTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  } finally {
    client.release();
  }
});

// Add this new endpoint for task statistics
router.get('/stats', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the first and last day of the current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const result = await client.query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
        TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'Month YYYY') as current_month
      FROM employee_tasks 
      WHERE assigned_to = $1
      AND created_at >= $2
      AND created_at <= $3`,
      [req.user.id, firstDayOfMonth.toISOString(), lastDayOfMonth.toISOString()]
    );

    const stats = result.rows[0];
    const total = parseInt(stats.total_tasks) || 0;

    res.json({
      total,
      completed: parseInt(stats.completed_tasks) || 0,
      inProgress: parseInt(stats.in_progress_tasks) || 0,
      pending: parseInt(stats.pending_tasks) || 0,
      completionRate: total ? Math.round((parseInt(stats.completed_tasks) / total) * 100) : 0,
      currentMonth: stats.current_month.trim()
    });
  } catch (error) {
    console.error('Error fetching task stats:', error);
    res.status(500).json({ error: 'Failed to fetch task statistics' });
  } finally {
    client.release();
  }
});

// Group Admin: Update task
router.patch('/:taskId', verifyToken, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { assignedTo, dueDate, isReassignment } = req.body;

    // Get the current task details first
    const currentTask = await client.query(
      `SELECT * FROM employee_tasks WHERE id = $1`,
      [taskId]
    );

    if (currentTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update task
    const result = await client.query(
      `UPDATE employee_tasks 
       SET assigned_to = $1, 
           due_date = $2,
           is_reassigned = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND assigned_by = $5
       RETURNING *`,
      [assignedTo, dueDate, isReassignment, taskId, req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  } finally {
    client.release();
  }
});

export default router; 