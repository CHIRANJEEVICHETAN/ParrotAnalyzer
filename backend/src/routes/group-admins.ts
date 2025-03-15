import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest, CSVHeaders, ParsedCSV } from '../types';

const upload = multer();
const router = express.Router();

// Get group admins list
router.get('/', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    if (!['management', 'super-admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.created_at,
        c.name as company_name
      FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.role = 'group-admin'
      AND (
        $1 = 'super-admin' 
        OR 
        (u.company_id = (SELECT company_id FROM users WHERE id = $2))
      )
      ORDER BY u.created_at DESC
    `, [req.user?.role, req.user?.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching group admins:', error);
    res.status(500).json({ error: 'Failed to fetch group admins' });
  }
});

// Helper function to check user limit
async function checkUserLimit(client: any, companyId: number) {
  // Get company details including user limit
  const companyResult = await client.query(
    `SELECT name, user_limit FROM companies WHERE id = $1`,
    [companyId]
  );

  if (!companyResult.rows.length) {
    throw new Error('Company not found');
  }

  const company = companyResult.rows[0];

  // Get current user count for the company (excluding management users)
  const userCountResult = await client.query(
    `SELECT COUNT(*) as count FROM users 
     WHERE company_id = $1 AND role IN ('group-admin', 'employee')`,
    [companyId]
  );

  const currentUserCount = parseInt(userCountResult.rows[0].count);
  const userLimit = parseInt(company.user_limit);

  return {
    canAddUser: currentUserCount < userLimit,
    currentUserCount,
    userLimit,
    companyName: company.name
  };
}

// Create single group admin
router.post('/', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!['management', 'super-admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, email, phone, password, gender } = req.body;

    if (!name || !email || !password || !gender) {
      return res.status(400).json({ 
        error: 'Missing required fields'
      });
    }

    // Validate gender value
    const validGenders = ['male', 'female', 'other'];
    if (!validGenders.includes(gender.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid gender value'
      });
    }

    await client.query('BEGIN');

    let companyId;
    if (req.user?.role === 'super-admin') {
      companyId = req.body.company_id;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required for super admin' });
      }
    } else {
      const userResult = await client.query(
        'SELECT company_id FROM users WHERE id = $1',
        [req.user?.id]
      );
      companyId = userResult.rows[0].company_id;
    }

    // Check user limit before creating
    const { canAddUser, currentUserCount, userLimit, companyName } = await checkUserLimit(client, companyId);
    
    if (!canAddUser) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'User limit reached',
        details: {
          message: `Unable to create group admin. Your company (${companyName}) has reached its user limit.`,
          currentCount: currentUserCount,
          limit: userLimit
        }
      });
    }

    const companyResult = await client.query(
      'SELECT status FROM companies WHERE id = $1',
      [companyId]
    );

    if (!companyResult.rows.length || companyResult.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or inactive company' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await client.query(
      `INSERT INTO users (name, email, phone, password, role, company_id, gender, management_id)
       VALUES ($1, $2, $3, $4, 'group-admin', $5, $6, $7)
       RETURNING id, name, email, phone, created_at`,
      [name, email, phone || null, hashedPassword, companyId, gender.toLowerCase(), req.user?.id]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating group admin:', error);
    res.status(500).json({ error: 'Failed to create group admin' });
  } finally {
    client.release();
  }
});

// Bulk create group admins from CSV
router.post('/bulk', verifyToken, upload.single('file'), async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!['management', 'super-admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await client.query('BEGIN');

    let companyId;
    if (req.user?.role === 'super-admin') {
      companyId = req.body.company_id;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }
    } else {
      const userResult = await client.query(
        'SELECT company_id FROM users WHERE id = $1',
        [req.user?.id]
      );
      companyId = userResult.rows[0].company_id;
    }

    const fileContent = req.file.buffer.toString();
    const parsedRows: ParsedCSV = parse(fileContent, {
      skip_empty_lines: true,
      trim: true
    });

    if (parsedRows.length < 2) {
      return res.status(400).json({ error: 'File is empty or missing headers' });
    }

    // Check user limit before processing bulk creation
    const { canAddUser, currentUserCount, userLimit, companyName } = await checkUserLimit(client, companyId);
    const newUsersCount = parsedRows.length - 1; // Subtract 1 for header row

    if (currentUserCount + newUsersCount > userLimit) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'User limit exceeded',
        details: {
          message: `Unable to create ${newUsersCount} group admins. Your company (${companyName}) would exceed its user limit.`,
          currentCount: currentUserCount,
          limit: userLimit,
          remainingSlots: userLimit - currentUserCount,
          attemptedToAdd: newUsersCount
        }
      });
    }

    const headerRow = parsedRows[0];
    const headers: CSVHeaders = {};
    headerRow.forEach((header: string, index: number) => {
      headers[header.toLowerCase()] = index;
    });

    const results = [];
    const errors = [];

    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        const groupAdmin = {
          name: row[headers['name']]?.trim(),
          email: row[headers['email']]?.trim(),
          phone: row[headers['phone']]?.trim(),
          password: row[headers['password']]?.trim(),
          gender: row[headers['gender']]?.trim().toLowerCase()
        };

        if (!groupAdmin.name || !groupAdmin.email || !groupAdmin.password || !groupAdmin.gender) {
          errors.push({ row: i + 1, error: 'Missing required fields' });
          continue;
        }

        // Validate gender value
        const validGenders = ['male', 'female', 'other'];
        if (!validGenders.includes(groupAdmin.gender)) {
          errors.push({ row: i + 1, error: 'Invalid gender value' });
          continue;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(groupAdmin.password, salt);

        const result = await client.query(
          `INSERT INTO users (name, email, phone, password, role, company_id, gender, management_id)
           VALUES ($1, $2, $3, $4, 'group-admin', $5, $6, $7)
           RETURNING id, name, email, phone`,
          [
            groupAdmin.name,
            groupAdmin.email,
            groupAdmin.phone,
            hashedPassword,
            companyId,
            groupAdmin.gender,
            req.user?.id
          ]
        );

        results.push(result.rows[0]);
      } catch (error) {
        errors.push({ row: i + 1, error: 'Failed to create group admin' });
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ success: results, errors });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk create:', error);
    res.status(500).json({ error: 'Failed to process bulk creation' });
  } finally {
    client.release();
  }
});

export default router; 