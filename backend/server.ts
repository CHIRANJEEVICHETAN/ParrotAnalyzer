import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB, seedUsers } from './src/config/database';
import authRoutes from './src/routes/auth';
import expenseRoutes from './src/routes/expenses';
import companyRoutes from './src/routes/companies';
import scheduleRoutes from './src/routes/schedule';
import groupAdminRoutes from './src/routes/group-admin';
import userRoutes from './src/routes/users';
import employeeRoutes from './src/routes/employee';
import groupAdminsRoutes from './src/routes/group-admins';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/group-admin', groupAdminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/group-admins', groupAdminsRoutes);

const PORT = process.env.PORT || 3000;

// Initialize database and start server
initDB().then(() => {
  seedUsers().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});