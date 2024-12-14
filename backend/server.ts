import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

dotenv.config();

// Add this interface at the top of the file, after imports
interface CustomRequest extends Request {
  user?: {
    id: number;
    email: string;
    phone: string;
    role: string;
  };
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
  try {
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
    const client = await pool.connect();
    try {
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
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error creating company:', error);
    res.status(500).json({ 
      error: 'Failed to create company',
      details: error.message
    });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});