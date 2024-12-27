import express, { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import multer from 'multer';
import { PoolClient } from 'pg';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images and PDFs only
    if (!file.originalname.match(/\.(jpg|jpeg|png|pdf)$/)) {
      return cb(new Error('Only image and PDF files are allowed!'));
    }
    cb(null, true);
  }
});

// Add this function at the top of the file
const createNotification = async (client: PoolClient, userId: number, title: string, message: string, type: string) => {
  await client.query(
    `INSERT INTO notifications (user_id, title, message, type) 
     VALUES ($1, $2, $3, $4)`,
    [userId, title, message, type]
  );
};

// Place the employee specific route BEFORE other routes
// Add this route at the beginning of the file, right after creating the router
router.get('/employee/my-expenses', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    console.log('Accessing employee my-expenses route with user:', {
      id: req.user?.id,
      role: req.user?.role
    });

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // First check if the user has any expenses
    const checkQuery = await client.query(
      'SELECT COUNT(*) FROM expenses WHERE user_id = $1',
      [req.user.id]
    );
    
    console.log('Found expenses count:', checkQuery.rows[0].count);

    const result = await client.query(
      `SELECT 
        id,
        date,
        total_amount,
        amount_payable,
        status,
        rejection_reason,
        created_at,
        vehicle_type,
        vehicle_number,
        total_kilometers,
        route_taken,
        lodging_expenses,
        daily_allowance,
        diesel,
        toll_charges,
        other_expenses,
        advance_taken
      FROM expenses
      WHERE user_id = $1
      ORDER BY created_at DESC`,
      [req.user.id]
    );

    console.log('Query results:', {
      rowCount: result.rowCount,
      firstRow: result.rows[0] || null
    });

    res.json(result.rows);
  } catch (error) {
    console.error('Detailed error in employee expenses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch expenses',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Group Admin routes should come first
router.get('/group-admin/expenses', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    console.log('Accessing group-admin expenses route with user:', {
      id: req.user?.id,
      role: req.user?.role
    });

    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'No user found in request'
      });
    }

    if (req.user.role !== 'group-admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        details: `Only group admins can access this resource. Your role is: ${req.user.role}`
      });
    }

    const result = await client.query(`
      SELECT 
        e.id,
        e.date,
        CAST(e.total_amount AS FLOAT) as total_amount,
        CAST(e.amount_payable AS FLOAT) as amount_payable,
        e.status,
        CASE 
          WHEN e.status = 'approved' THEN true
          WHEN e.status = 'rejected' THEN false
          ELSE null
        END as group_admin_approved,
        false as management_approved,
        u.name as employee_name,
        u.employee_number,
        u.department
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE u.group_admin_id = $1
      ORDER BY e.created_at DESC`,
      [req.user.id]
    );

    console.log('Query results:', {
      rowCount: result.rowCount,
      firstRow: result.rows[0]
    });

    res.json(result.rows);
  } catch (error) {
    console.error('Error in group-admin expenses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch expenses',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  } finally {
    client.release();
  }
});

// Group Admin approval route
router.post('/group-admin/:id/approve', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { approved, comments = '' } = req.body;

    // First get the expense details including user_id
    const expenseResult = await client.query(
      `SELECT e.*, u.name as employee_name 
       FROM expenses e 
       JOIN users u ON e.user_id = u.id 
       WHERE e.id = $1`,
      [id]
    );

    if (expenseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = expenseResult.rows[0];

    // Update the expense status
    const result = await client.query(
      `UPDATE expenses 
       SET status = $1,
           comments = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND EXISTS (
         SELECT 1 FROM users 
         WHERE id = expenses.user_id 
         AND group_admin_id = $4
       )
      RETURNING *`,
      [approved ? 'approved' : 'rejected', comments || null, id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to update expense');
    }

    // Create notification for the employee
    const notificationTitle = approved ? 'Expense Approved' : 'Expense Rejected';
    const notificationMessage = approved
      ? `Your expense claim of ₹${expense.total_amount} has been approved.`
      : `Your expense claim of ₹${expense.total_amount} has been rejected. Reason: ${comments}`;

    await createNotification(
      client,
      expense.user_id,
      notificationTitle,
      notificationMessage,
      approved ? 'approval' : 'rejection'
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in expense approval:', error);
    res.status(500).json({ 
      error: 'Failed to process expense',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  } finally {
    client.release();
  }
});

// Group Admin report routes
router.get('/group-admin/reports/expenses/summary', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await client.query(`
      WITH employee_expenses AS (
        SELECT e.*
       FROM expenses e
       JOIN users u ON e.user_id = u.id
       WHERE u.group_admin_id = $1
      )
      SELECT 
        CAST(COALESCE(SUM(total_amount), 0) AS FLOAT) as total_amount,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
      FROM employee_expenses`,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    res.status(500).json({ error: 'Failed to fetch expense summary' });
  } finally {
    client.release();
  }
});

router.get('/group-admin/reports/expenses/by-employee', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await client.query(`
      SELECT 
        u.name as employee_name, 
        CAST(COALESCE(SUM(e.total_amount), 0) AS FLOAT) as total_expenses,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN e.status = 'rejected' THEN 1 END) as rejected_count
      FROM users u
      LEFT JOIN expenses e ON e.user_id = u.id
      WHERE u.group_admin_id = $1
      AND u.role = 'employee'
      GROUP BY u.id, u.name
      ORDER BY total_expenses DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employee expense report:', error);
    res.status(500).json({ error: 'Failed to fetch employee expense report' });
  } finally {
    client.release();
  }
});

// Update the expense submission route
router.post('/submit', verifyToken, upload.array('documents'), async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    console.log('Starting expense submission with user:', {
      id: req.user?.id,
      role: req.user?.role
    });

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // First get the user's group_admin_id and company_id
    const userResult = await client.query(
      'SELECT group_admin_id, company_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult.rows.length) {
      return res.status(400).json({ error: 'User not found' });
    }

    const { group_admin_id, company_id } = userResult.rows[0];

    if (!group_admin_id) {
      return res.status(400).json({ error: 'No group admin assigned to user' });
    }

    await client.query('BEGIN');

    // Parse travel and expense details
    const savedTravelDetails = JSON.parse(req.body.savedTravelDetails || '[]');
    const savedExpenseDetails = JSON.parse(req.body.savedExpenseDetails || '[]');
    const allTravelDetails = [
      ...savedTravelDetails,
      {
        vehicleType: req.body.vehicleType,
        vehicleNumber: req.body.vehicleNumber,
        totalKilometers: req.body.totalKilometers,
        startDateTime: req.body.startDateTime,
        endDateTime: req.body.endDateTime,
        routeTaken: req.body.routeTaken
      }
    ];

    const allExpenseDetails = [
      ...savedExpenseDetails,
      {
        lodgingExpenses: req.body.lodgingExpenses,
        dailyAllowance: req.body.dailyAllowance,
        diesel: req.body.diesel,
        tollCharges: req.body.tollCharges,
        otherExpenses: req.body.otherExpenses
      }
    ];

    // Insert an expense record for each travel detail
    for (const travelDetail of allTravelDetails) {
      // Calculate total amount for this travel detail
      const expenseDetail = allExpenseDetails[allTravelDetails.indexOf(travelDetail)] || {
        lodgingExpenses: 0,
        dailyAllowance: 0,
        diesel: 0,
        tollCharges: 0,
        otherExpenses: 0
      };

      const totalAmount = 
        Number(expenseDetail.lodgingExpenses || 0) +
        Number(expenseDetail.dailyAllowance || 0) +
        Number(expenseDetail.diesel || 0) +
        Number(expenseDetail.tollCharges || 0) +
        Number(expenseDetail.otherExpenses || 0);

      const amountPayable = totalAmount - Number(req.body.advanceTaken || 0);

      const expenseResult = await client.query(`
        INSERT INTO expenses (
          user_id, company_id, group_admin_id, employee_name, employee_number, 
          department, designation, location, date, vehicle_type, vehicle_number, 
          total_kilometers, start_time, end_time, route_taken, lodging_expenses, 
          daily_allowance, diesel, toll_charges, other_expenses, advance_taken, 
          total_amount, amount_payable, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
          $16, $17, $18, $19, $20, $21, $22, $23, 'pending', CURRENT_TIMESTAMP, 
          CURRENT_TIMESTAMP
        ) RETURNING id`,
        [
          req.user.id,
          company_id,
          group_admin_id,
          req.body.employeeName,
          req.body.employeeNumber,
          req.body.department,
          req.body.designation,
          req.body.location,
          new Date(req.body.date),
          travelDetail.vehicleType,
          travelDetail.vehicleNumber,
          travelDetail.totalKilometers,
          new Date(travelDetail.startDateTime),
          new Date(travelDetail.endDateTime),
          travelDetail.routeTaken,
          expenseDetail.lodgingExpenses || 0,
          expenseDetail.dailyAllowance || 0,
          expenseDetail.diesel || 0,
          expenseDetail.tollCharges || 0,
          expenseDetail.otherExpenses || 0,
          req.body.advanceTaken || 0,
          totalAmount,
          amountPayable
        ]
      );

      const expenseId = expenseResult.rows[0].id;

      // Handle document uploads if any
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          await client.query(`
            INSERT INTO expense_documents (
              expense_id, file_name, file_type, file_size, file_data
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              expenseId,
              file.originalname,
              file.mimetype,
              file.size,
              file.buffer
            ]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('Expense submission completed successfully');
    res.json({ message: 'Expense submitted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in expense submission:', error);
    res.status(500).json({ 
      error: 'Failed to submit expense',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Finally add the generic routes
router.get('/:id', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    console.log('Fetching expense details for ID:', req.params.id);

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Query to get expense details with employee information
    const result = await client.query(`
      SELECT 
        e.*,
        u.name as employee_name,
        u.employee_number,
        u.department,
        u.designation
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.id = $1
      AND (
        -- Allow access if user is the group admin of the employee
        (
          $2 = 'group-admin' 
          AND u.group_admin_id = $3
        )
        -- Or if user is management
        OR $2 = 'management'
        -- Or if user is the employee who submitted the expense
        OR (
          $2 = 'employee' 
          AND e.user_id = $3
        )
      )`,
      [req.params.id, req.user.role, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Expense not found',
        details: 'The expense does not exist or you do not have permission to view it'
      });
    }

    // Convert numeric fields to ensure they're numbers
    const expense = result.rows[0];
    const numericFields = [
      'total_amount',
      'amount_payable',
      'lodging_expenses',
      'daily_allowance',
      'diesel',
      'toll_charges',
      'other_expenses',
      'advance_taken',
      'total_kilometers'
    ];

    numericFields.forEach(field => {
      if (expense[field]) {
        expense[field] = parseFloat(expense[field]);
      }
    });

    console.log('Expense details found:', {
      id: expense.id,
      employee: expense.employee_name,
      status: expense.status
    });

    res.json(expense);
  } catch (error) {
    console.error('Error fetching expense details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch expense details',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  } finally {
    client.release();
  }
});

// Add this route to fetch documents for an expense
router.get('/:id/documents', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // First check if user has access to this expense
    const accessCheck = await client.query(`
      SELECT 1
       FROM expenses e
       JOIN users u ON e.user_id = u.id
      WHERE e.id = $1
      AND (
        (
          $2 = 'group-admin' 
          AND u.group_admin_id = $3
        )
        OR $2 = 'management'
        OR (
          $2 = 'employee' 
          AND e.user_id = $3
        )
      )`,
      [req.params.id, req.user.role, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Access denied',
        details: 'You do not have permission to view these documents'
      });
    }

    // Fetch documents
    const result = await client.query(`
      SELECT 
        id,
        file_name,
        file_type,
        file_size,
        file_data,
        created_at
      FROM expense_documents
      WHERE expense_id = $1
      ORDER BY created_at DESC`,
      [req.params.id]
    );

    // Convert binary data to base64
    const documents = result.rows.map(doc => ({
      ...doc,
      file_data: doc.file_data.toString('base64')
    }));

    res.json(documents);
  } catch (error) {
    console.error('Error fetching expense documents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch documents',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  } finally {
    client.release();
  }
});

export default router;