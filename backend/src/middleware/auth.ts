import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { CustomRequest, JwtPayload } from '../types';

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const verifyToken = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `SELECT 
            u.id, u.name, u.email, u.role, u.company_id, 
            u.token_version, c.status as company_status
           FROM users u
           LEFT JOIN companies c ON u.company_id = c.id
           WHERE u.id = $1`,
          [decoded.id]
        );

        if (!result.rows.length) {
          return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        if (user.role !== 'super-admin' && 
            user.company_id && 
            user.company_status === 'disabled') {
          return res.status(403).json({ 
            error: 'Company access disabled. Please contact administrator.',
            code: 'COMPANY_DISABLED'
          });
        }

        if (decoded.token_version !== undefined && 
            decoded.token_version !== user.token_version) {
          return res.status(401).json({ 
            error: 'Session expired. Please login again.',
            code: 'TOKEN_VERSION_MISMATCH'
          });
        }

        req.user = user;
        next();
      } finally {
        client.release();
      }
    } catch (error) {
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