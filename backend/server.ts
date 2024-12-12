import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';

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

// Database initialization
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'group-admin', 'management', 'super-admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

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

// Authentication endpoints
app.post('/auth/login', async (req, res) => {
  console.log('Login attempt:', {
    body: req.body,
    headers: req.headers
  });

  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ 
        error: 'Email/phone and password are required' 
      });
    }

    // Check if identifier is email or phone
    const isEmail = identifier.includes('@');
    const query = isEmail 
      ? 'SELECT * FROM users WHERE email = $1'
      : 'SELECT * FROM users WHERE phone = $1';

    console.log('Executing query:', { query, identifier });
    const result = await pool.query(query, [identifier]);

    if (result.rows.length === 0) {
      console.log('User not found');
      return res.status(404).json({ 
        error: 'User not found. Please check your email/phone' 
      });
    }

    const user = result.rows[0];
    console.log('User found:', { id: user.id, email: user.email });
    
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('Invalid password');
      return res.status(401).json({ 
        error: 'Invalid password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        phone: user.phone,
        role: user.role 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    console.log('Login successful:', { userId: user.id });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'An error occurred during login. Please try again later.' 
    });
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

// Protected route example
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});