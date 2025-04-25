import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { CustomRequest, JwtPayload } from '../types';
import { User } from '../types/user';

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const authenticateToken = async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Authentication token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Get the user ID from the decoded token - could be 'id' or 'userId' depending on how the token was created
        const userId = decoded.id || decoded.userId;
        
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token format' });
        }
        
        // Get user from database
        const result = await pool.query(
            'SELECT id, name, email, role, company_id, group_admin_id FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const userData = result.rows[0];
        // Ensure user object matches User interface
        req.user = {
            id: parseInt(userData.id),
            name: userData.name,
            email: userData.email,
            role: userData.role,
            company_id: parseInt(userData.company_id),
            group_admin_id: userData.group_admin_id ? parseInt(userData.group_admin_id) : undefined,
            token: token
        };
        next();
    } catch (error) {
        console.error('Token validation error:', error);
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
};

export const verifyToken = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('Auth header:', authHeader); // Debug log

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'No valid authorization header found'
      });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      console.log('Decoded token:', decoded); // Debug log

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
          return res.status(401).json({ 
            error: 'Authentication failed',
            details: 'User not found'
          });
        }

        const user = result.rows[0];
        // Ensure the user object matches the User interface
        req.user = {
          id: parseInt(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          company_id: parseInt(user.company_id),
          token: token
        };
        next();
      } finally {
        client.release();
      }
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ 
          error: 'Token expired',
          details: 'Please login again'
        });
      }
      return res.status(401).json({ 
        error: 'Invalid token',
        details: 'Token validation failed'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: 'Authentication process failed'
    });
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

export const managementMiddleware = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!result.rows.length || result.rows[0].role !== 'management') {
      return res.status(403).json({ error: 'Management access required' });
    }

    next();
  } catch (error) {
    console.error('Management middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}; 