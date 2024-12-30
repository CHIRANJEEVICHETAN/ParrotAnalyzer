import express, { Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { pool } from '../config/database';
import { CustomRequest } from '../types';
import multer from 'multer';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get management profile data
router.get('/profile', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.profile_image,
        c.name as company_name,
        c.id as company_id,
        u.role
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1 AND u.role = 'management'
    `, [req.user.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];
    
    // Convert profile_image to base64 if it exists
    if (profile.profile_image) {
      profile.profile_image = profile.profile_image.toString('base64');
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching management profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  } finally {
    client.release();
  }
});

// Update management profile
router.put('/profile', authMiddleware, upload.single('profileImage'), async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, phone } = req.body;
    const profileImage = req.file?.buffer;

    await client.query('BEGIN');

    // Start building the query
    let query = `
      UPDATE users 
      SET 
        name = $1,
        phone = $2,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    let values = [name, phone];
    
    // Add profile image to update if provided
    if (profileImage) {
      query += `, profile_image = $${values.length + 1}`;
      values.push(profileImage);
    }
    
    query += ` WHERE id = $${values.length + 1} AND role = 'management' RETURNING id`;
    values.push(req.user.id);

    const updateResult = await client.query(query, values);

    if (!updateResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get updated profile with company information
    const profileResult = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.profile_image,
        c.name as company_name,
        c.id as company_id
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1
    `, [updateResult.rows[0].id]);

    await client.query('COMMIT');

    const updatedProfile = profileResult.rows[0];
    
    // Convert profile_image to base64 if it exists
    if (updatedProfile.profile_image) {
      updatedProfile.profile_image = updatedProfile.profile_image.toString('base64');
    }

    res.json(updatedProfile);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating management profile:', error);
    res.status(500).json({ 
      error: 'Failed to update profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

export default router; 