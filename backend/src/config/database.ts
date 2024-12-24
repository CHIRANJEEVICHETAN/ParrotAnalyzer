import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';


dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Database initialization functions
export const initExpensesTable = async () => {
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

export const initScheduleTable = async () => {
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

export const initDB = async () => {
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
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        profile_image BYTEA,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Update expenses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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

    // Update schedule table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        date DATE NOT NULL,
        time TIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Update expense_documents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expense_documents (
        id SERIAL PRIMARY KEY,
        expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add support_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        user_email VARCHAR(100) NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        user_role VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      )
    `);

    // Add employee_shifts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_shifts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTERVAL,
        status VARCHAR(20) DEFAULT 'active',
        total_kilometers DECIMAL DEFAULT 0,
        total_expenses DECIMAL DEFAULT 0,
        location_start POINT,
        location_end POINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add employee_tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to INTEGER REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_status_update TIMESTAMP,
        status_history JSONB DEFAULT '[]'
      )
    `);

    // Add employee_schedule table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_schedule (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        time TIME NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export const seedUsers = async () => {
  try {
    const existingUsers = await pool.query('SELECT * FROM users');
    if (existingUsers.rows.length > 0) {
      console.log('Users already exist, skipping seed');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password@123', salt);

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