import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { JWT_SECRET } from '../middleware/auth';
import { CustomRequest, ResetToken } from '../types';

const router = express.Router();

// Store reset tokens (in production, use Redis or database)
const resetTokens = new Map<string, ResetToken>();

// Update the type definitions for request bodies
interface LoginRequest extends Request {
  body: {
    identifier: string;
    password: string;
  }
}

interface ForgotPasswordRequest extends Request {
  body: {
    email: string;
  }
}

interface VerifyOTPRequest extends Request {
  body: {
    email: string;
    otp: string;
  }
}

interface ResetPasswordRequest extends Request {
  body: {
    email: string;
    otp: string;
    newPassword: string;
  }
}

router.post('/login', async (req: LoginRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { identifier, password } = req.body;

    const isEmail = identifier.includes('@');
    const query = isEmail
      ? `SELECT u.*, c.status as company_status 
         FROM users u 
         LEFT JOIN companies c ON u.company_id = c.id 
         WHERE u.email = $1`
      : `SELECT u.*, c.status as company_status 
         FROM users u 
         LEFT JOIN companies c ON u.company_id = c.id 
         WHERE u.phone = $1`;

    const result = await client.query(query, [identifier]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check company status for non-super-admin users
    if (user.role !== 'super-admin' && 
        user.company_id && 
        user.company_status === 'disabled') {
      return res.status(403).json({ 
        error: 'Company access disabled. Please contact administrator.',
        code: 'COMPANY_DISABLED'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Increment failed login attempts
      await client.query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1',
        [user.id]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed login attempts and update last login
    await client.query(
      'UPDATE users SET failed_login_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate access token (24h expiry)
    const accessToken = jwt.sign(
      { 
        id: user.id,
        role: user.role,
        company_id: user.company_id,
        token_version: user.token_version,
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Generate refresh token (7 days expiry)
    const refreshToken = jwt.sign(
      { 
        id: user.id,
        token_version: user.token_version,
        type: 'refresh'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  } finally {
    client.release();
  }
});

router.post('/forgot-password', async (req: ForgotPasswordRequest, res: Response) => {
  try {
    const { email } = req.body;

    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    resetTokens.set(email, {
      email,
      token: otp,
      expires,
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${otp}. This code will expire in 30 minutes.`,
      html: `
        <h1>Password Reset Code</h1>
        <p>Your password reset code is: <strong>${otp}</strong></p>
        <p>This code will expire in 30 minutes.</p>
      `,
    });

    res.json({ message: 'Reset code sent successfully' });
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/verify-otp', (req: VerifyOTPRequest, res: Response) => {
  try {
    const { email, otp } = req.body;
    const resetToken = resetTokens.get(email);

    if (!resetToken || resetToken.token !== otp || resetToken.expires < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    res.json({ message: 'Code verified successfully' });
  } catch (error) {
    console.error('Error in verify OTP:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

router.post('/reset-password', async (req: ResetPasswordRequest, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    const resetToken = resetTokens.get(email);

    if (!resetToken || resetToken.token !== otp || resetToken.expires < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, email]
    );

    resetTokens.delete(email);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error in reset password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      console.log('No refresh token provided');
      return res.status(400).json({ error: 'Refresh token required' });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload;

      // Log decoded token for debugging
      console.log('Decoded refresh token:', {
        ...decoded,
        exp: new Date(decoded.exp! * 1000).toISOString(),
        iat: new Date(decoded.iat! * 1000).toISOString()
      });

      // Validate token type first
      if (decoded.type !== 'refresh') {
        console.log('Invalid token type:', decoded.type);
        return res.status(401).json({ 
          error: 'Invalid token type',
          details: 'Expected refresh token but received ' + decoded.type
        });
      }

      // Check token expiration explicitly
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        console.log('Token expired:', {
          expiry: new Date(decoded.exp * 1000).toISOString(),
          now: new Date(now * 1000).toISOString()
        });
        return res.status(401).json({ error: 'Refresh token expired' });
      }

      const result = await client.query(
        `SELECT u.*, c.status as company_status 
         FROM users u 
         LEFT JOIN companies c ON u.company_id = c.id 
         WHERE u.id = $1 AND u.token_version = $2`,
        [decoded.id, decoded.token_version]
      );

      if (result.rows.length === 0) {
        console.log('No user found or token version mismatch:', {
          userId: decoded.id,
          tokenVersion: decoded.token_version
        });
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      const user = result.rows[0];

      // Check company status
      if (user.role !== 'super-admin' && 
          user.company_id && 
          user.company_status === 'disabled') {
        return res.status(403).json({ 
          error: 'Company access disabled, please contact administrator',
          code: 'COMPANY_DISABLED'
        });
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        { 
          id: user.id,
          role: user.role,
          company_id: user.company_id,
          token_version: user.token_version,
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        accessToken: newAccessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          company_id: user.company_id
        }
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log('Refresh token expired');
        return res.status(401).json({ error: 'Refresh token expired' });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        console.log('Invalid refresh token:', error.message);
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  } finally {
    client.release();
  }
});

router.get('/check-role', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    console.log('Check role request:', {
      user: req.user,
      headers: req.headers
    });
    
    if (!req.user) {
      return res.status(401).json({ error: 'No user found' });
    }

    res.json({
      role: req.user.role,
      id: req.user.id,
      name: req.user.name
    });
  } catch (error) {
    console.error('Check role error:', error);
    res.status(500).json({ error: 'Failed to check role' });
  }
});

export default router; 