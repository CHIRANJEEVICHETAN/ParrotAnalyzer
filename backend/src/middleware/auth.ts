import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CustomRequest, JwtPayload } from '../types';
import { pool } from '../config/database';

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
      console.log('Token verified successfully');

      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT id, name, email, role, company_id FROM users WHERE id = $1',
          [decoded.id]
        );

        if (!result.rows.length) {
          console.log('User not found in database');
          return res.status(401).json({ error: 'User not found' });
        }
        // Check if token is about to expire (within 5 minutes)
        const expirationTime = (decoded.exp || 0) * 1000; // Convert to milliseconds
        const currentTime = Date.now();
        const timeUntilExpiration = expirationTime - currentTime;
        const fiveMinutes = 5 * 60 * 1000;

        if (timeUntilExpiration < fiveMinutes) {
          // Generate new token with extended expiration
          const newToken = jwt.sign(
            { 
              id: decoded.id, 
              role: decoded.role,
              company_id: decoded.company_id 
            },
            JWT_SECRET,
            { expiresIn: '24h' } // 24 hours
          );
          
          // Send new token in response header
          res.setHeader('X-New-Token', newToken);
        }

        req.user = result.rows[0];
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

export const requireSuperAdmin = (req: CustomRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'super-admin') {
    return res.status(403).json({ error: 'Access denied. Super admin only.' });
  }
  next();
}; 