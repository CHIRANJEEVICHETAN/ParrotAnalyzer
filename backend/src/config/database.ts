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
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        date TIMESTAMP NOT NULL,
        total_amount DECIMAL NOT NULL,
        amount_payable DECIMAL NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        vehicle_type VARCHAR(50),
        vehicle_number VARCHAR(50),
        total_kilometers DECIMAL,
        route_taken TEXT,
        lodging_expenses DECIMAL DEFAULT 0,
        daily_allowance DECIMAL DEFAULT 0,
        diesel DECIMAL DEFAULT 0,
        toll_charges DECIMAL DEFAULT 0,
        other_expenses DECIMAL DEFAULT 0,
        advance_taken DECIMAL DEFAULT 0
      )
    `);
    console.log('Expenses table initialized');
  } catch (error) {
    console.error('Error initializing expenses table:', error);
    throw error;
  } finally {
    client.release();
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
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add status column if it doesn't exist
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'employee_schedule' 
          AND column_name = 'status'
        ) THEN
          ALTER TABLE employee_schedule ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
        END IF;
      END $$;
    `);

    // Add leave_balances table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_balances (
        id SERIAL PRIMARY KEY,
        group_admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        casual_leave INTEGER DEFAULT 10,
        sick_leave INTEGER DEFAULT 7,
        annual_leave INTEGER DEFAULT 14,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_group_admin_id UNIQUE (group_admin_id)
      );

      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        group_admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        leave_type VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT NOT NULL,
        contact_number VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add group_admin_id column to users table if it doesn't exist
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = 'group_admin_id'
        ) THEN
          ALTER TABLE users ADD COLUMN group_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;

      -- Update existing employees to link them to their group admin
      UPDATE users e
      SET group_admin_id = ga.id
      FROM users ga
      WHERE e.role = 'employee' 
      AND ga.role = 'group-admin'
      AND e.company_id = ga.company_id
      AND e.group_admin_id IS NULL;
    `);

    // Add expenses table with group_admin_id
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        group_admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        description TEXT,
        amount DECIMAL(10,2),
        total_amount DECIMAL(10,2),
        date DATE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Add group_admin_id column if it doesn't exist
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'expenses' 
          AND column_name = 'group_admin_id'
        ) THEN
          ALTER TABLE expenses ADD COLUMN group_admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
          
          -- Update existing expenses with group_admin_id from the user's group_admin
          UPDATE expenses e
          SET group_admin_id = u.group_admin_id
          FROM users u
          WHERE e.user_id = u.id
          AND e.group_admin_id IS NULL;
        END IF;
      END $$;
    `);

    // Add these lines after other table creation
    await initEmployeeShiftsTable();
    await seedUsers();
    
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

    const users = [
      {
        name: 'Loginware Employee',
        email: 'employee1@loginwaresofttec.com',
        phone: '+919876543974',
        hashedPassword: await bcrypt.hash('Loginware_employee1', salt),
        role: 'employee'
      },
      {
        name: 'Loginware Admin',
        email: 'admin@loginwaresofttec.com',
        phone: '+919876543288',
        hashedPassword: await bcrypt.hash('Loginware_admin1', salt),
        role: 'group-admin'
      },
      {
        name: 'Loginware Manager',
        email: 'manager@loginwaresofttec.com',
        phone: '+919876543839',
        hashedPassword: await bcrypt.hash('Loginware_manager1', salt),
        role: 'management'
      },
      {
        name: 'Loginware Super Admin',
        email: 'super@loginwaresofttec.com',
        phone: '+919876543253',
        hashedPassword: await bcrypt.hash('Loginware_super1', salt),
        role: 'super-admin'
      }
    ];

    for (const user of users) {
      await pool.query(
        `INSERT INTO users (name, email, phone, password, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.name, user.email, user.phone, user.hashedPassword, user.role]
      );
    }

    console.log('Test users created successfully');
  } catch (error) {
    console.error('Error seeding users:', error);
  }
};

// Add this function to create employee_shifts_daily table
export const initEmployeeShiftsTable = async () => {
  const client = await pool.connect();
  try {
    // First create the employee_shifts table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_shifts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTERVAL,
        total_kilometers DECIMAL DEFAULT 0,
        total_expenses DECIMAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Then create the employee_shifts_daily table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_shifts_daily (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        date DATE NOT NULL,
        shifts JSONB DEFAULT '[]',
        total_hours DECIMAL DEFAULT 0,
        total_distance DECIMAL DEFAULT 0,
        total_expenses DECIMAL DEFAULT 0,
        shift_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    console.log('Employee shifts tables initialized');
  } catch (error) {
    console.error('Error initializing employee shifts tables:', error);
    throw error;
  } finally {
    client.release();
  }
}; 