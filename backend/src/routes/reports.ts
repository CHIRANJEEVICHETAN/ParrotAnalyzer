import express, { Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';

// Add type definitions
interface Report {
  id: number;
  type: 'expense' | 'attendance' | 'activity';
  title: string;
  date: Date | string;
  amount: number | null;
  status: string | null;
}

interface DatabaseError {
  message?: string;
  code?: string;
  position?: string;
  detail?: string;
  severity?: string;
  hint?: string;
  internalPosition?: string;
  internalQuery?: string;
  where?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  file?: string;
  line?: string;
  routine?: string;
}

const router = express.Router();

// Get all reports for a group admin
router.get('/', authMiddleware, adminMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = req.user.id;
    
    // Get reports from different tables
    try {
      // Get expense reports
      const expenseReports = await client.query<Report>(
        `SELECT 
          CONCAT('exp_', id) as id,
          'expense' as type,
          'Expense Report' as title,
          COALESCE(date, created_at)::timestamp as date,
          COALESCE(total_amount, 0) as amount,
          COALESCE(status, 'pending') as status
         FROM expenses 
         WHERE group_admin_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [adminId]
      );

      // Get attendance reports
      const attendanceReports = await client.query<Report>(
        `SELECT 
          CONCAT('att_', id) as id,
          'attendance' as type,
          'Attendance Report' as title,
          date::timestamp as date,
          NULL as amount,
          COALESCE(status, 'pending') as status
         FROM employee_schedule 
         WHERE user_id IN (
           SELECT id FROM users WHERE group_admin_id = $1
         )
         ORDER BY date DESC 
         LIMIT 5`,
        [adminId]
      );

      // Get activity reports (from tasks)
      const activityReports = await client.query<Report>(
        `SELECT 
          CONCAT('act_', id) as id,
          'activity' as type,
          'Task Report' as title,
          created_at::timestamp as date,
          NULL as amount,
          COALESCE(status, 'pending') as status
         FROM employee_tasks 
         WHERE assigned_by = $1
         ORDER BY created_at DESC 
         LIMIT 5`,
        [adminId]
      );

      // Add type assertion for combined reports
      const allReports = [
        ...expenseReports.rows,
        ...attendanceReports.rows,
        ...activityReports.rows
      ].sort((a: Report, b: Report) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA;
      });

      res.json(allReports.slice(0, 10));

    } catch (dbError: unknown) {
      console.error('Database query error:', dbError);
      const error = dbError as DatabaseError;
      res.status(500).json({ 
        error: 'Database error', 
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          detail: error.detail,
          hint: error.hint
        } : undefined 
      });
    }
  } catch (error: unknown) {
    console.error('Error fetching reports:', error);
    const err = error as Error;
    res.status(500).json({ 
      error: 'Failed to fetch reports',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    client.release();
  }
});

export default router; 