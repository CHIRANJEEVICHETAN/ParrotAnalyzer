import express, { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import multer from 'multer';

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

// Add endpoint to get file
router.get('/documents/:id', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    // First check if user has access to this document
    const docResult = await client.query(
      `SELECT d.*, e.user_id, e.company_id 
       FROM expense_documents d
       JOIN expenses e ON d.expense_id = e.id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (!docResult.rows.length) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = docResult.rows[0];

    // Check if user has access (employee, group admin, or management)
    if (req.user?.role === 'employee' && doc.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user?.role === 'group-admin') {
      const hasAccess = await client.query(
        'SELECT 1 FROM users WHERE id = $1 AND company_id = $2',
        [req.user.id, doc.company_id]
      );
      if (!hasAccess.rows.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Set response headers
    res.setHeader('Content-Type', doc.file_type);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
    
    // Send file data
    res.send(doc.file_data);

  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ error: 'Failed to get document' });
  } finally {
    client.release();
  }
});

// Direct expense submission route - NO AUTH REQUIRED
router.post('/submit', upload.array('supportingDocs', 5), async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log('Files received:', req.files ? req.files.length : 0);
    if (req.files && Array.isArray(req.files)) {
      console.log('File details:', req.files.map(f => ({
        name: f.originalname,
        type: f.mimetype,
        size: f.size,
        buffer: f.buffer ? `${f.buffer.length} bytes` : 'Missing'
      })));
    }

    const { 
      employeeName, 
      employeeNumber, 
      department, 
      designation,
      location,
      date,
      totalAmount,
      amountPayable,
      advanceTaken
    } = req.body;

    // Parse travel and expense details
    const travelDetails = JSON.parse(req.body.travelDetails || '[]');
    const expenseDetails = JSON.parse(req.body.expenseDetails || '[]');

    console.log('Received expense submission:', {
      employeeName,
      employeeNumber,
      department,
      designation,
      location,
      date,
      totalAmount,
      amountPayable,
      files: req.files?.length,
      travelDetailsCount: travelDetails.length,
      expenseDetailsCount: expenseDetails.length
    });

    // Basic validation
    if (!employeeName || !employeeNumber || !department || !designation) {
      console.log('Missing required fields:', { employeeName, employeeNumber, department, designation });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // First verify the employee exists
    console.log('Verifying employee:', employeeNumber);
    const employeeResult = await client.query(
      'SELECT id, company_id FROM users WHERE employee_number = $1 AND role = $2',
      [employeeNumber, 'employee']
    );

    if (!employeeResult.rows.length) {
      console.log('Employee not found:', employeeNumber);
      return res.status(404).json({ error: 'Employee not found' });
    }

    const userId = employeeResult.rows[0].id;
    const companyId = employeeResult.rows[0].company_id;

    // Start transaction
    await client.query('BEGIN');

    try {
      const insertedExpenseIds = [];

      // Function to calculate total amount for a single expense entry
      const calculateExpenseTotal = (expenseDetail: any) => {
        return (
          parseFloat(expenseDetail.lodgingExpenses || '0') +
          parseFloat(expenseDetail.dailyAllowance || '0') +
          parseFloat(expenseDetail.diesel || '0') +
          parseFloat(expenseDetail.tollCharges || '0') +
          parseFloat(expenseDetail.otherExpenses || '0')
        );
      };

      // Handle each travel and expense detail pair
      const totalEntries = Math.max(travelDetails.length, expenseDetails.length);
      
      for (let i = 0; i < totalEntries; i++) {
        const travelDetail = travelDetails[i] || {};
        const expenseDetail = expenseDetails[i] || {};
        
        // Calculate individual expense total
        const entryTotal = calculateExpenseTotal(expenseDetail);
        const entryAdvanceTaken = i === 0 ? parseFloat(advanceTaken) || 0 : 0; // Only apply advance to first entry
        const entryAmountPayable = entryTotal - entryAdvanceTaken;

        const expenseResult = await client.query(
          `INSERT INTO expenses (
            user_id,
            employee_name,
            employee_number,
            department,
            designation,
            location,
            date,
            vehicle_type,
            vehicle_number,
            total_kilometers,
            start_time,
            end_time,
            route_taken,
            lodging_expenses,
            daily_allowance,
            diesel,
            toll_charges,
            other_expenses,
            total_amount,
            amount_payable,
            advance_taken,
            status,
            company_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          RETURNING id`,
          [
            userId,
            employeeName,
            employeeNumber,
            department,
            designation,
            location,
            new Date(date),
            travelDetail.vehicleType || null,
            travelDetail.vehicleNumber || null,
            parseFloat(travelDetail.totalKilometers) || null,
            travelDetail.startDateTime ? new Date(travelDetail.startDateTime) : null,
            travelDetail.endDateTime ? new Date(travelDetail.endDateTime) : null,
            travelDetail.routeTaken || null,
            parseFloat(expenseDetail.lodgingExpenses) || 0,
            parseFloat(expenseDetail.dailyAllowance) || 0,
            parseFloat(expenseDetail.diesel) || 0,
            parseFloat(expenseDetail.tollCharges) || 0,
            parseFloat(expenseDetail.otherExpenses) || 0,
            entryTotal,
            entryAmountPayable,
            entryAdvanceTaken,
            'pending',
            companyId
          ]
        );

        insertedExpenseIds.push(expenseResult.rows[0].id);
      }

      // Save files if present (associate with the first expense entry)
      if (req.files && Array.isArray(req.files) && req.files.length > 0 && insertedExpenseIds.length > 0) {
        console.log('Saving files to database...');
        for (const file of req.files) {
          try {
            const result = await client.query(
              `INSERT INTO expense_documents (
                expense_id,
                file_name,
                file_type,
                file_size,
                file_data
              ) VALUES ($1, $2, $3, $4, $5)
              RETURNING id`,
              [
                insertedExpenseIds[0], // Associate with first expense
                file.originalname,
                file.mimetype,
                file.size,
                file.buffer
              ]
            );
            console.log(`File ${file.originalname} saved with ID:`, result.rows[0].id);
          } catch (err) {
            console.error('Error saving file:', file.originalname, err);
            throw err;
          }
        }
      }

      // Commit transaction
      await client.query('COMMIT');
      console.log('Transaction committed successfully');

      res.status(201).json({
        message: 'Expenses submitted successfully',
        expenseIds: insertedExpenseIds
      });

    } catch (err) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      console.error('Database error during transaction:', err);
      throw err;
    }

  } catch (err: any) {
    console.error('Server error details:', {
      name: err?.name || 'Unknown',
      message: err?.message || 'Unknown error occurred',
      stack: err?.stack,
      code: err?.code,
      detail: err?.detail,
      table: err?.table,
      constraint: err?.constraint
    });
    
    res.status(500).json({ 
      error: 'Failed to submit expense',
      details: err?.message || 'Unknown error occurred'
    });
  } finally {
    client.release();
  }
});

// Middleware to check expense submission access
const checkExpenseAccess = async (req: CustomRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const client = await pool.connect();
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Only employees can submit expenses' });
    }

    const result = await client.query(
      `SELECT 
        u.can_submit_expenses_anytime,
        u.shift_status,
        c.status as company_status
      FROM users u
      JOIN users ga ON u.group_admin_id = ga.id
      JOIN companies c ON ga.company_id = c.id
      WHERE u.id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { can_submit_expenses_anytime, shift_status, company_status } = result.rows[0];

    if (company_status !== 'active') {
      return res.status(403).json({ 
        error: 'Access denied',
        details: 'Company is not active. Please contact your administrator.'
      });
    }

    if (!can_submit_expenses_anytime && shift_status !== 'active') {
      return res.status(403).json({ 
        error: 'Access denied',
        details: 'You can only submit expenses during active shifts'
      });
    }

    next();
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ error: 'Failed to verify permissions' });
  } finally {
    client.release();
  }
};

// Apply middleware to expense routes
router.use(verifyToken, checkExpenseAccess);

// Submit expense
router.post('/', async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await client.query(
      `INSERT INTO expenses (
        user_id, employee_name, employee_number, department, designation,
        location, date, total_amount, amount_payable
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        req.user.id,
        req.body.employeeName,
        req.body.employeeNumber,
        req.body.department,
        req.body.designation,
        req.body.location,
        req.body.date,
        req.body.totalAmount,
        req.body.amountPayable
      ]
    );

    res.status(201).json({
      message: 'Expense submitted successfully',
      expense: result.rows[0]
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Failed to submit expense' });
  } finally {
    client.release();
  }
});

// Get expenses for group admin approval
router.get('/group-admin/pending', async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await client.query(
      `SELECT e.*, u.name as employee_name, u.employee_number
       FROM expenses e
       JOIN users u ON e.user_id = u.id
       WHERE u.group_admin_id = $1
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  } finally {
    client.release();
  }
});

// Get expenses for management approval
router.get('/management/pending', async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'management') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await client.query(
      `SELECT e.*, 
        u.name as employee_name, 
        u.employee_number,
        ga.name as group_admin_name
       FROM expenses e
       JOIN users u ON e.user_id = u.id
       JOIN users ga ON u.group_admin_id = ga.id
       WHERE ga.company_id = (
         SELECT company_id FROM users WHERE id = $1
       )
       AND e.group_admin_approved = true
       AND e.management_approved IS NULL
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  } finally {
    client.release();
  }
});

// Approve expense by group admin
router.post('/:id/group-admin/approve', async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { approved, comments } = req.body;

    const result = await client.query(
      `UPDATE expenses 
       SET group_admin_approved = $1,
           group_admin_comments = $2,
           group_admin_action_date = CURRENT_TIMESTAMP
       WHERE id = $3 AND EXISTS (
         SELECT 1 FROM users 
         WHERE id = expenses.user_id 
         AND group_admin_id = $4
       )
       RETURNING *`,
      [approved, comments, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found or unauthorized' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving expense:', error);
    res.status(500).json({ error: 'Failed to approve expense' });
  } finally {
    client.release();
  }
});

// Approve expense by management
router.post('/:id/management/approve', async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'management') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { approved, comments } = req.body;

    const result = await client.query(
      `UPDATE expenses 
       SET management_approved = $1,
           management_comments = $2,
           management_action_date = CURRENT_TIMESTAMP,
           status = CASE WHEN $1 = true THEN 'approved' ELSE 'rejected' END
       WHERE id = $3 AND group_admin_approved = true
       RETURNING *`,
      [approved, comments, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found or not approved by group admin' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving expense:', error);
    res.status(500).json({ error: 'Failed to approve expense' });
  } finally {
    client.release();
  }
});

// Get expense details
router.get('/:id', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT e.*, 
        u.name as employee_name,
        u.employee_number,
        ga.name as group_admin_name,
        ga.email as group_admin_email
       FROM expenses e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN users ga ON u.group_admin_id = ga.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching expense details:', error);
    res.status(500).json({ error: 'Failed to fetch expense details' });
  } finally {
    client.release();
  }
});

// Add other expense-related routes...

export default router;