import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const caPath = path.join(__dirname, 'ca.pem');


dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: fs.readFileSync(caPath).toString(),
  },
});

// Database initialization functions
export const initDB = async () => {
  try {
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