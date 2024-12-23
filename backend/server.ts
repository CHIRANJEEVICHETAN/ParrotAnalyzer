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
import tasksRoutes from './src/routes/tasks';
import notificationsRouter from './src/routes/notifications';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
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
app.use('/api/tasks', tasksRoutes);
app.use('/api/notifications', notificationsRouter);

// Test route at root level
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// Route not found handler
app.use((req, res, next) => {
  console.log('Route not found:', req.method, req.path);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method 
  });
});

// Basic error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;

// Initialize database and start server
initDB().then(() => {
  seedUsers().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Available routes:');
      console.log('- /auth/*');
      console.log('- /api/expenses/*');
      console.log('- /api/companies/*');
      console.log('- /api/schedule/*');
      console.log('- /api/group-admin/*');
      console.log('- /api/users/*');
      console.log('- /api/employee/*');
      console.log('- /api/group-admins/*');
      console.log('- /api/tasks/*');
      console.log('- /api/notifications/*');
    });
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});