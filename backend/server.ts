import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

dotenv.config();

// Add this interface at the top of the file, after imports
interface CustomRequest extends Request {
  user?: {
    id: number;
    email: string;
    phone: string;
    role: string;
  };
  file?: any;
}

// Add this interface for expense data
interface ExpenseData {
  employeeName: string;
  employeeNumber: string;
  department: string;
  designation: string;
  location: string;
  date: string;
  vehicleType: string;
  vehicleNumber?: string;
  totalKilometers: string;
  startTime: string;
  endTime: string;
  routeTaken: string;
  lodgingExpenses: string;
  dailyAllowance: string;
  diesel: string;
  tollCharges: string;
  otherExpenses: string;
  advanceTaken: string;
  totalAmount: number;
  amountPayable: number;
  supportingDocs?: any[];
}

// Add this interface
interface ResetToken {
  email: string;
  token: string;
  expires: Date;
}

// Add type for CSV row
interface CSVRow extends Array<string> {
  [index: number]: string;
}

interface CSVHeaders {
  [key: string]: number;
}

interface CSVRowData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface EmployeeData {
  name: string;
  employeeNumber: string;
  email: string;
  phone: string;
  password: string;
  department: string;
  designation: string;
  can_submit_expenses_anytime?: boolean;
}

interface DatabaseError {
  code?: string;
  message?: string;
  detail?: string;
}

type ParsedCSV = string[][];

const app = express();
app.use(cors());
app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Neon PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Move middleware declarations to the top
// Middleware to verify JWT token
const verifyToken = (req: CustomRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified as CustomRequest['user'];
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

// Add this middleware
const requireSuperAdmin = (req: CustomRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'super-admin') {
    return res.status(403).json({ error: 'Access denied. Super admin only.' });
  }
  next();
};

// Database initialization functions
const initExpensesTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        employee_name VARCHAR(100) NOT NULL,
        employee_number VARCHAR(50) NOT NULL,
        department VARCHAR(100) NOT NULL,
        designation VARCHAR(100),
        location VARCHAR(100),
        date TIMESTAMP NOT NULL,
        vehicle_type VARCHAR(50),
        vehicle_number VARCHAR(50),
        total_kilometers DECIMAL,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        route_taken TEXT,
        lodging_expenses DECIMAL DEFAULT 0,
        daily_allowance DECIMAL DEFAULT 0,
        diesel DECIMAL DEFAULT 0,
        toll_charges DECIMAL DEFAULT 0,
        other_expenses DECIMAL DEFAULT 0,
        advance_taken DECIMAL DEFAULT 0,
        total_amount DECIMAL NOT NULL,
        amount_payable DECIMAL NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Expenses table initialized successfully');
  } catch (error) {
    console.error('Error initializing expenses table:', error);
  }
};

const initScheduleTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        date DATE NOT NULL,
        time TIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Schedule table initialized successfully');
  } catch (error) {
    console.error('Error initializing schedule table:', error);
  }
};

const initDB = async () => {
  try {
    // First create companies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        address TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Then create users table with company_id reference
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'group-admin', 'management', 'super-admin')),
        company_id INTEGER REFERENCES companies(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await initExpensesTable();
    await initScheduleTable();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error; // Re-throw to catch initialization failures
  }
};

// Add a temporary storage for OTPs (in production, use a database)
const resetTokens = new Map<string, ResetToken>();

// Add middleware to check expense submission access
const checkExpenseAccess = async (req: CustomRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const client = await pool.connect();
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Only employees can submit expenses' });
    }

    // Get employee's permissions and company status
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

    // Check company status
    if (company_status !== 'active') {
      return res.status(403).json({ 
        error: 'Access denied',
        details: 'Company is not active. Please contact your administrator.'
      });
    }

    // Check if employee can submit expenses
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

// Use the middleware for expense-related routes
app.use('/api/expenses', checkExpenseAccess);

// Now define your routes
app.post('/api/expenses', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const expenseData: ExpenseData = req.body;
    const userId = req.user?.id;

    console.log('Received expense data:', expenseData);
    console.log('User ID:', userId);

    // Validate required fields
    const requiredFields = [
      'employeeName',
      'employeeNumber',
      'department',
      'date',
      'totalKilometers',
      'totalAmount',
      'amountPayable'
    ];

    for (const field of requiredFields) {
      if (!expenseData[field as keyof ExpenseData]) {
        return res.status(400).json({ 
          error: `Missing required field: ${field}` 
        });
      }
    }

    // Convert string amounts to numbers if needed
    const numericFields = [
      'lodgingExpenses',
      'dailyAllowance',
      'diesel',
      'tollCharges',
      'otherExpenses',
      'advanceTaken',
      'totalAmount',
      'amountPayable'
    ];

    const sanitizedData: any = { ...expenseData };
    for (const field of numericFields) {
      if (typeof sanitizedData[field] === 'string') {
        sanitizedData[field] = parseFloat(sanitizedData[field]) || 0;
      }
    }

    // Insert expense into database
    const result = await pool.query(
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
        advance_taken,
        total_amount,
        amount_payable,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING id`,
      [
        userId,
        sanitizedData.employeeName,
        sanitizedData.employeeNumber,
        sanitizedData.department,
        sanitizedData.designation,
        sanitizedData.location,
        sanitizedData.date,
        sanitizedData.vehicleType,
        sanitizedData.vehicleNumber,
        sanitizedData.totalKilometers,
        sanitizedData.startTime,
        sanitizedData.endTime,
        sanitizedData.routeTaken,
        sanitizedData.lodgingExpenses,
        sanitizedData.dailyAllowance,
        sanitizedData.diesel,
        sanitizedData.tollCharges,
        sanitizedData.otherExpenses,
        sanitizedData.advanceTaken,
        sanitizedData.totalAmount,
        sanitizedData.amountPayable,
        'pending'
      ]
    );

    res.status(201).json({
      message: 'Expense claim submitted successfully',
      expenseId: result.rows[0].id
    });

  } catch (error) {
    console.error('Error submitting expense:', error);
    res.status(500).json({ error: 'Failed to submit expense claim' });
  }
});

app.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;

    // Find user by email or phone
    const userResult = await pool.query(
      'SELECT u.*, c.status as company_status FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.email = $1 OR u.phone = $1',
      [identifier]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check if company is disabled (except for super-admin)
    if (user.role !== 'super-admin' && user.company_status === 'disabled') {
      return res.status(403).json({ error: 'Your company account is currently disabled. Please contact support.' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove sensitive data before sending
    delete user.password;
    delete user.company_status;

    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/register', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Validate role
    const validRoles = ['employee', 'group-admin', 'management', 'super-admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
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

app.get('/user/profile', verifyToken, async (req: CustomRequest, res: Response) => {
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

const seedUsers = async () => {
  try {
    // Check if we already have users
    const existingUsers = await pool.query('SELECT * FROM users');
    if (existingUsers.rows.length > 0) {
      console.log('Users already exist, skipping seed');
      return;
    }

    // Hash password (using 'Password@123' for all test users)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password@123', salt);

    // Test users data
    const users = [
      {
        name: 'John Employee',
        email: 'employee@test.com',
        phone: '+919876543210',
        role: 'employee'
      },
      {
        name: 'Sarah Admin',
        email: 'admin@test.com',
        phone: '+919876543211',
        role: 'group-admin'
      },
      {
        name: 'Mike Manager',
        email: 'manager@test.com',
        phone: '+919876543212',
        role: 'management'
      },
      {
        name: 'Lisa Super',
        email: 'super@test.com',
        phone: '+919876543213',
        role: 'super-admin'
      }
    ];

    // Insert test users
    for (const user of users) {
      await pool.query(
        `INSERT INTO users (name, email, phone, password, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.name, user.email, user.phone, hashedPassword, user.role]
      );
    }

    console.log('Test users created successfully');
  } catch (error) {
    console.error('Error seeding users:', error);
  }
};

initDB().then(() => {
  seedUsers();
});

app.get('/api/schedule', verifyToken, async (req: CustomRequest, res: Response) => {
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
    
    console.log('Sending schedule data:', result.rows); // Debug log
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

app.post('/api/schedule', verifyToken, async (req: CustomRequest, res: Response) => {
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

// Add these endpoints
app.post('/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store OTP
    resetTokens.set(email, {
      email,
      token: otp,
      expires,
    });

    // Send email with OTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${otp}. This code will expire in 30 minutes.`,
      html: `
        <h1>Password Reset Code</h1>
        <p>Your password reset code is: <strong>${otp}</strong></p>
        <p>This code will expire in 30 minutes.</p>
      `,
    });

    res.json({ message: 'Reset code sent successfully' });
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

app.post('/auth/verify-otp', (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const resetToken = resetTokens.get(email);

    if (!resetToken || resetToken.token !== otp || resetToken.expires < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    res.json({ message: 'Code verified successfully' });
  } catch (error) {
    console.error('Error in verify OTP:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

app.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    const resetToken = resetTokens.get(email);

    if (!resetToken || resetToken.token !== otp || resetToken.expires < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in database
    await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, email]
    );

    // Remove used token
    resetTokens.delete(email);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error in reset password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Create new company with management account
app.post('/api/companies', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user || req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { 
      companyName, 
      companyEmail, 
      companyAddress, 
      managementName, 
      managementEmail, 
      managementPhone, 
      managementPassword 
    } = req.body;

    // Validate required fields
    if (!companyName || !companyEmail || !managementName || !managementEmail || !managementPassword) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: {
          companyName: !companyName,
          companyEmail: !companyEmail,
          managementName: !managementName,
          managementEmail: !managementEmail,
          managementPassword: !managementPassword
        }
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // Check if company email already exists
    const existingCompany = await client.query(
      'SELECT id FROM companies WHERE email = $1',
      [companyEmail]
    );

    if (existingCompany.rows.length > 0) {
      throw new Error('Company with this email already exists');
    }

    // Check if management email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [managementEmail]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Management email already exists');
    }

    // Insert company
    const companyResult = await client.query(
      `INSERT INTO companies (name, email, address, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [companyName, companyEmail, companyAddress]
    );

    const companyId = companyResult.rows[0].id;

    // Hash password for management account
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(managementPassword, salt);

    // Create management account
    await client.query(
      `INSERT INTO users (name, email, phone, password, role, company_id)
       VALUES ($1, $2, $3, $4, 'management', $5)`,
      [managementName, managementEmail, managementPhone, hashedPassword, companyId]
    );

    await client.query('COMMIT');
    res.status(201).json({ 
      message: 'Company created successfully',
      companyId: companyId
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    
    const dbError = error as DatabaseError;
    if (dbError.code === '23505') {
      return res.status(409).json({ error: 'Company name already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create company' });
  } finally {
    client.release();
  }
});

// Get all companies
app.get('/api/companies', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.status,
        c.created_at,
        (
          SELECT json_build_object(
            'name', u.name,
            'email', u.email,
            'phone', u.phone
          )
          FROM users u 
          WHERE u.company_id = c.id AND u.role = 'management'
          LIMIT 1
        ) as management,
        (
          SELECT COUNT(*) 
          FROM users 
          WHERE company_id = c.id AND role != 'management'
        ) as user_count
      FROM companies c
      ORDER BY c.name
    `);
    
    // Format the response
    const companies = result.rows.map(company => ({
      ...company,
      management: company.management || null,
      user_count: parseInt(company.user_count) || 0
    }));

    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Toggle company status
app.patch('/api/companies/:id/toggle-status', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update company status
    const result = await client.query(
      `UPDATE companies 
       SET status = CASE WHEN status = 'active' THEN 'disabled' ELSE 'active' END
       WHERE id = $1
       RETURNING status`,
      [req.params.id]
    );
    
    const newStatus = result.rows[0].status;

    // If company is disabled, invalidate all user tokens (in a real app, you'd use Redis or similar)
    if (newStatus === 'disabled') {
      // You might want to implement a token blacklist or force users to reauthenticate
      // For now, we'll just log it
      console.log(`Company ${req.params.id} disabled - users will need to reauthenticate`);
    }

    await client.query('COMMIT');
    res.json({ 
      message: 'Company status updated successfully',
      status: newStatus
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating company status:', error);
    res.status(500).json({ error: 'Failed to update company status' });
  } finally {
    client.release();
  }
});

// Delete company
app.delete('/api/companies/:id', verifyToken, requireSuperAdmin, async (req: CustomRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Delete all users associated with the company
      await client.query('DELETE FROM users WHERE company_id = $1', [id]);
      
      // Delete the company
      await client.query('DELETE FROM companies WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      res.json({ message: 'Company deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

// Get group admins for a company
app.get('/api/group-admins', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    // Only management and super-admin can access this
    if (!['management', 'super-admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.created_at,
        c.name as company_name
      FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.role = 'group-admin'
      AND (
        $1 = 'super-admin' 
        OR 
        (u.company_id = (SELECT company_id FROM users WHERE id = $2))
      )
      ORDER BY u.created_at DESC
    `, [req.user?.role, req.user?.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching group admins:', error);
    res.status(500).json({ error: 'Failed to fetch group admins' });
  }
});

// Create a single group admin
app.post('/api/group-admins', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    // Only management and super-admin can create group admins
    if (!['management', 'super-admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, email, phone, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        errors: {
          name: !name ? 'Name is required' : null,
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null
        }
      });
    }

    // Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format',
        errors: { email: 'Invalid email format' }
      });
    }

    await client.query('BEGIN');

    // Get company_id for the new group admin
    let companyId;
    if (req.user?.role === 'super-admin') {
      // Super admin needs to specify company_id in request
      companyId = req.body.company_id;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required for super admin' });
      }
    } else {
      // Management users can only create group admins for their company
      const userResult = await client.query(
        'SELECT company_id FROM users WHERE id = $1',
        [req.user?.id]
      );
      
      if (!userResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid user or company association' });
      }
      
      companyId = userResult.rows[0].company_id;
    }

    // Check if company exists and is active
    const companyResult = await client.query(
      'SELECT status FROM companies WHERE id = $1',
      [companyId]
    );

    if (!companyResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    if (companyResult.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Company is not active' });
    }

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Email already exists',
        errors: { email: 'Email already exists' }
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create group admin
    const result = await client.query(
      `INSERT INTO users (name, email, phone, password, role, company_id)
       VALUES ($1, $2, $3, $4, 'group-admin', $5)
       RETURNING id, name, email, phone, created_at`,
      [name, email, phone || null, hashedPassword, companyId]
    );

    await client.query('COMMIT');

    // Log success for debugging
    console.log('Group admin created successfully:', {
      id: result.rows[0].id,
      name: result.rows[0].name,
      email: result.rows[0].email
    });

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating group admin:', {
      error: error.message,
      stack: error.stack,
      details: error
    });
    
    // Send more specific error messages
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Email already exists' });
    } else if (error.code === '23503') { // Foreign key violation
      res.status(400).json({ error: 'Invalid company ID' });
    } else {
      res.status(500).json({ 
        error: 'Failed to create group admin',
        details: error.message
      });
    }
  } finally {
    client.release();
  }
});

// Bulk create group admins from CSV
const upload = multer();

app.post('/api/group-admins/bulk', verifyToken, upload.single('file'), async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!['management', 'super-admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await client.query('BEGIN');

    // Get company_id
    let companyId;
    if (req.user?.role === 'super-admin') {
      companyId = req.body.company_id;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }
    } else {
      const userResult = await client.query(
        'SELECT company_id FROM users WHERE id = $1',
        [req.user?.id]
      );
      companyId = userResult.rows[0].company_id;
    }

    // Read and parse CSV file
    const fileContent = req.file.buffer.toString();
    const parsedRows: ParsedCSV = parse(fileContent, {
      skip_empty_lines: true,
      trim: true
    });

    if (parsedRows.length < 2) {
      return res.status(400).json({ error: 'File is empty or missing headers' });
    }

    const headerRow = parsedRows[0];
    const headers: CSVHeaders = {};
    headerRow.forEach((header: string, index: number) => {
      headers[header.toLowerCase()] = index;
    });

    const results: any[] = [];
    const errors: any[] = [];

    // Process each row (skip header)
    for (let i = 1; i < parsedRows.length; i++) {
      const row: string[] = parsedRows[i];
      try {
        const admin: CSVRowData = {
          name: row[headers['name']]?.trim() || '',
          email: row[headers['email']]?.trim() || '',
          phone: row[headers['phone']]?.trim() || '',
          password: row[headers['password']]?.trim() || ''
        };

        // Validate required fields
        if (!admin.name || !admin.email || !admin.password) {
          errors.push({ row: i + 1, error: 'Missing required fields' });
          continue;
        }

        // Check if email exists
        const existingUser = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [admin.email]
        );

        if (existingUser.rows.length > 0) {
          errors.push({ row: i + 1, email: admin.email, error: 'Email already exists' });
          continue;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(admin.password, salt);

        // Create group admin
        const result = await client.query(
          `INSERT INTO users (name, email, phone, password, role, company_id)
           VALUES ($1, $2, $3, $4, 'group-admin', $5)
           RETURNING id, name, email, phone`,
          [admin.name, admin.email, admin.phone, hashedPassword, companyId]
        );

        results.push(result.rows[0]);
      } catch (error) {
        errors.push({ row: i + 1, error: 'Failed to create user' });
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: results,
      errors: errors
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk create:', error);
    res.status(500).json({ error: 'Failed to process bulk creation' });
  } finally {
    client.release();
  }
});

// Delete group admin
app.delete('/api/group-admins/:id', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    // Only management and super-admin can delete group admins
    if (!['management', 'super-admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Verify the group admin belongs to the correct company for management users
    if (req.user?.role === 'management') {
      const checkResult = await pool.query(
        `SELECT u.id FROM users u
         WHERE u.id = $1 AND u.role = 'group-admin'
         AND u.company_id = (SELECT company_id FROM users WHERE id = $2)`,
        [id, req.user?.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Group admin deleted successfully' });
  } catch (error) {
    console.error('Error deleting group admin:', error);
    res.status(500).json({ error: 'Failed to delete group admin' });
  }
});

// Get employees for a group admin
app.get('/api/group-admin/employees', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const result = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.created_at,
        u.can_submit_expenses_anytime,
        u.shift_status
      FROM users u
      WHERE u.group_admin_id = $1
      AND u.role = 'employee'
      ORDER BY u.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  } finally {
    client.release();
  }
});

// Create single employee
app.post('/api/group-admin/employees', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const { 
      name, 
      employeeNumber, 
      email, 
      phone, 
      password, 
      department, 
      designation, 
      can_submit_expenses_anytime 
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !employeeNumber || !department) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        errors: {
          name: !name ? 'Name is required' : null,
          employeeNumber: !employeeNumber ? 'Employee number is required' : null,
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null,
          department: !department ? 'Department is required' : null
        }
      });
    }

    await client.query('BEGIN');

    // Check if email or employee number exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 OR employee_number = $2',
      [email, employeeNumber]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Email or Employee Number already exists',
        errors: { 
          email: 'Email or Employee Number already exists'
        }
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create employee with new fields
    const result = await client.query(
      `INSERT INTO users (
        name, 
        employee_number,
        email, 
        phone, 
        password, 
        role, 
        department,
        designation,
        group_admin_id, 
        can_submit_expenses_anytime
      ) VALUES ($1, $2, $3, $4, $5, 'employee', $6, $7, $8, $9)
      RETURNING id, name, employee_number, email, phone, department, designation, created_at, can_submit_expenses_anytime`,
      [
        name,
        employeeNumber,
        email,
        phone || null,
        hashedPassword,
        department,
        designation || null,
        req.user.id,
        can_submit_expenses_anytime || false
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  } finally {
    client.release();
  }
});

// Bulk create employees from CSV
app.post('/api/group-admin/employees/bulk', verifyToken, upload.single('file'), async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await client.query('BEGIN');

    const fileContent = req.file.buffer.toString();
    const parsedRows: ParsedCSV = parse(fileContent, {
      skip_empty_lines: true,
      trim: true
    });

    if (parsedRows.length < 2) {
      return res.status(400).json({ error: 'File is empty or missing headers' });
    }

    const headerRow = parsedRows[0];
    const headers: CSVHeaders = {};
    headerRow.forEach((header: string, index: number) => {
      headers[header.toLowerCase()] = index;
    });

    const results = [];
    const errors = [];

    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        const employee: EmployeeData = {
          name: row[headers['name']]?.trim() || '',
          employeeNumber: row[headers['employee_number']]?.trim() || '',
          email: row[headers['email']]?.trim() || '',
          phone: row[headers['phone']]?.trim() || '',
          password: row[headers['password']]?.trim() || '',
          department: row[headers['department']]?.trim() || '',
          designation: row[headers['designation']]?.trim() || '',
          can_submit_expenses_anytime: row[headers['can_submit_expenses_anytime']]?.trim().toLowerCase() === 'true'
        };

        // Validate required fields
        if (!employee.name || !employee.email || !employee.password || !employee.employeeNumber || !employee.department) {
          errors.push({ row: i + 1, error: 'Missing required fields' });
          continue;
        }

        // Check if email or employee number exists
        const existingUser = await client.query(
          'SELECT id FROM users WHERE email = $1 OR employee_number = $2',
          [employee.email, employee.employeeNumber]
        );

        if (existingUser.rows.length > 0) {
          errors.push({ row: i + 1, error: 'Email or Employee Number already exists' });
          continue;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(employee.password, salt);

        // Create employee with new fields
        const result = await client.query(
          `INSERT INTO users (
            name, 
            employee_number,
            email, 
            phone, 
            password, 
            role, 
            department,
            designation,
            group_admin_id, 
            can_submit_expenses_anytime
          ) VALUES ($1, $2, $3, $4, $5, 'employee', $6, $7, $8, $9)
          RETURNING id, name, employee_number, email, phone, department, designation`,
          [
            employee.name,
            employee.employeeNumber,
            employee.email,
            employee.phone,
            hashedPassword,
            employee.department,
            employee.designation,
            req.user.id,
            employee.can_submit_expenses_anytime || false
          ]
        );

        results.push(result.rows[0]);
      } catch (error) {
        errors.push({ row: i + 1, error: 'Failed to create employee' });
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ success: results, errors });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk create:', error);
    res.status(500).json({ error: 'Failed to process bulk creation' });
  } finally {
    client.release();
  }
});

// Update employee access permission
app.patch('/api/group-admin/employees/:id/access', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const { id } = req.params;
    const { can_submit_expenses_anytime } = req.body;

    // Verify the employee belongs to this group admin
    const result = await client.query(
      `UPDATE users 
       SET can_submit_expenses_anytime = $1
       WHERE id = $2 AND group_admin_id = $3 AND role = 'employee'
       RETURNING id, name, email, can_submit_expenses_anytime`,
      [can_submit_expenses_anytime, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee access:', error);
    res.status(500).json({ error: 'Failed to update employee access' });
  } finally {
    client.release();
  }
});

// Delete employee
app.delete('/api/group-admin/employees/:id', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (req.user?.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group admin only.' });
    }

    const { id } = req.params;

    await client.query('BEGIN');

    // Delete employee
    const result = await client.query(
      'DELETE FROM users WHERE id = $1 AND group_admin_id = $2 AND role = \'employee\' RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Employee not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  } finally {
    client.release();
  }
});

// Add this endpoint for checking expense submission access
app.get('/api/expenses/check-access', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get employee's permissions and company status
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});