import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { CustomRequest, JwtPayload } from '../types';

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const verifyToken = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    console.log('\n=== Token Verification Start ===');
    
    const authHeader = req.headers.authorization;
    console.log('Authorization header present:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Invalid or missing authorization header');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token extracted, verifying...');

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      console.log('Token verified successfully, decoded payload:', {
        id: decoded.id,
        role: decoded.role
      });

      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT u.id, u.name, u.email, u.role, u.company_id, c.status as company_status
           FROM users u
           LEFT JOIN companies c ON u.company_id = c.id
           WHERE u.id = $1`,
          [decoded.id]
        );

        if (!result.rows.length) {
          console.log('User not found in database');
          return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        console.log('User found in database:', {
          id: user.id,
          role: user.role
        });

        req.user = user;
        next();
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const authMiddleware = verifyToken;

export const requireSuperAdmin = (req: CustomRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'super-admin') {
    return res.status(403).json({ error: 'Access denied. Super admin only.' });
  }
  next();
};

export const adminMiddleware = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'group-admin') {
      return res.status(403).json({ error: 'Access denied. Group Admin only.' });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 