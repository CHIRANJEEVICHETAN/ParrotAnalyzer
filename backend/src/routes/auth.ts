import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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

    console.log('Login attempt:', { identifier });

    const isEmail = identifier.includes('@');
    const query = isEmail
      ? 'SELECT * FROM users WHERE email = $1'
      : 'SELECT * FROM users WHERE phone = $1';

    const result = await client.query(query, [identifier]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    
    console.log('User found:', { 
      id: user.id,
      role: user.role,
      name: user.name 
    });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user.id,
        role: user.role,
        company_id: user.company_id 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Generated token payload:', {
      id: user.id,
      role: user.role,
      company_id: user.company_id
    });

    res.json({
      token,
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

router.post('/refresh', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not found' });
    }

    const userResult = await pool.query(
      'SELECT id, name, email, phone, role, company_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const newToken = jwt.sign(
      { 
        id: user.id,
        role: user.role,
        company_id: user.company_id 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token: newToken,
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
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
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