import express, { Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { verifyToken, requireSuperAdmin } from '../middleware/auth';
import { CustomRequest } from '../types';
import multer from 'multer';
import nodemailer from 'nodemailer';
const upload = multer();

const router = express.Router();

// Get user profile
router.get('/profile', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = $1',
      [req.user!.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// Register new user (super admin only)
router.post('/register', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    const validRoles = ['employee', 'group-admin', 'management', 'super-admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, role`,
      [name, email, phone, hashedPassword, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

// Add this endpoint after existing routes
router.post('/change-password', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify current password
    const userResult = await client.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(
      currentPassword, 
      userResult.rows[0].password
    );

    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await client.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  } finally {
    client.release();
  }
});

// Add this endpoint after existing routes
router.put('/profile', 
  verifyToken, 
  upload.single('profileImage'), 
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { name, phone } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate file if uploaded
      if (req.file) {
        const fileSize = req.file.size;
        const fileType = req.file.mimetype;

        // Check file size (5MB limit)
        if (fileSize > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'Image size should be less than 5MB' });
        }

        // Check file type
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(fileType)) {
          return res.status(400).json({ error: 'Only JPEG and PNG images are allowed' });
        }
      }

      await client.query('BEGIN');

      let query = `
        UPDATE users 
        SET name = $1, 
            phone = $2
      `;
      const values = [name, phone];

      // If image is uploaded, add it to the update
      if (req.file) {
        query += `, profile_image = $3`;
        values.push(req.file.buffer);
      }

      query += ` WHERE id = $${values.length + 1} RETURNING id, name, email, phone, profile_image`;
      values.push(userId);

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      await client.query('COMMIT');

      // Convert image buffer to base64 if exists
      const user = result.rows[0];
      if (user.profile_image) {
        user.profile_image = user.profile_image.toString('base64');
      }

      res.json(user);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile. Please try again.' });
    } finally {
      client.release();
    }
  }
);

// Add endpoint to get profile image
router.get('/profile-image/:id', async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT profile_image FROM users WHERE id = $1',
      [req.params.id]
    );

    // If no user found or no image, return a default response instead of error
    if (!result.rows.length || !result.rows[0].profile_image) {
      return res.json({ 
        image: null,
        message: 'No profile image found'
      });
    }

    const image = result.rows[0].profile_image;
    res.json({ image: image.toString('base64') });
  } catch (error) {
    console.error('Error fetching profile image:', error);
    res.status(500).json({ error: 'Failed to fetch profile image' });
  } finally {
    client.release();
  }
});

// Add this endpoint for support messages
router.post('/support-message', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const { subject, message } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'parrotanalyzer@gmail.com',
        pass: process.env.EMAIL_PASS
      },
    });

    // Prepare email content
    const emailContent = {
      from: process.env.EMAIL_USER || 'parrotanalyzer@gmail.com',
      to: 'parrotanalyzer@gmail.com',
      subject: `Support Request: ${subject}`,
      html: `
        <h2>Support Request from User</h2>
        <p><strong>From:</strong> ${req.user?.name} (${req.user?.email})</p>
        <p><strong>Role:</strong> ${req.user?.role}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <h3>Message:</h3>
        <p>${message}</p>
        <hr>
        <p><small>Sent from Parrot Analyzer Support System</small></p>
      `
    };

    // Send email
    await transporter.sendMail(emailContent);

    // Store in database if needed
    const result = await pool.query(
      `INSERT INTO support_messages (
        user_id, 
        subject, 
        message, 
        user_email,
        user_name,
        user_role
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at`,
      [
        req.user?.id,
        subject,
        message,
        req.user?.email,
        req.user?.name,
        req.user?.role
      ]
    );

    res.json({ 
      success: true,
      message: 'Support request sent successfully',
      ticketId: result.rows[0].id
    });

  } catch (error) {
    console.error('Error sending support message:', error);
    res.status(500).json({ 
      error: 'Failed to send support message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 