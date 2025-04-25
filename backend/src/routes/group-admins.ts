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
    if (!["management", "super-admin"].includes(req.user?.role || "")) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    await client.query("BEGIN");

    let companyId;
    if (req.user?.role === "super-admin") {
      companyId = req.body.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }
    } else {
      const userResult = await client.query(
        "SELECT company_id FROM users WHERE id = $1",
        [req.user?.id]
      );
      companyId = userResult.rows[0].company_id;
    }

    const fileContent = req.file.buffer.toString();
    const parsedRows: ParsedCSV = parse(fileContent, {
      skip_empty_lines: true,
      trim: true,
    });

    if (parsedRows.length < 2) {
      return res
        .status(400)
        .json({ error: "File is empty or missing headers" });
    }

    // Check user limit before processing bulk creation
    const { canAddUser, currentUserCount, userLimit, companyName } =
      await checkUserLimit(client, companyId);
    const newUsersCount = parsedRows.length - 1; // Subtract 1 for header row

    if (currentUserCount + newUsersCount > userLimit) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "User limit exceeded",
        details: {
          message: `Unable to create ${newUsersCount} group admins. Your company (${companyName}) would exceed its user limit.`,
          currentCount: currentUserCount,
          limit: userLimit,
          remainingSlots: userLimit - currentUserCount,
          attemptedToAdd: newUsersCount,
        },
      });
    }

    const headerRow = parsedRows[0];
    const headers: CSVHeaders = {};
    headerRow.forEach((header: string, index: number) => {
      headers[header.toLowerCase()] = index;
    });

    // Validate required headers
    const requiredHeaders = ["name", "email", "password", "gender"];
    const missingHeaders = requiredHeaders.filter(
      (header) => !(header in headers)
    );
    if (missingHeaders.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "CSV file is missing required headers",
        details: `Missing headers: ${missingHeaders.join(", ")}`,
      });
    }

    // Check for duplicate emails in the CSV file
    const emailSet = new Set();
    const duplicateEmails: string[] = [];
    for (let i = 1; i < parsedRows.length; i++) {
      const email = parsedRows[i][headers["email"]]?.trim();
      if (email) {
        if (emailSet.has(email)) {
          duplicateEmails.push(email);
        } else {
          emailSet.add(email);
        }
      }
    }

    if (duplicateEmails.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Duplicate emails found in CSV file",
        details: duplicateEmails,
      });
    }

    // Check for existing emails in the database
    const emails = Array.from(emailSet);
    if (emails.length > 0) {
      const existingEmailsResult = await client.query(
        `SELECT email FROM users WHERE email = ANY($1)`,
        [emails]
      );

      if (existingEmailsResult.rows.length > 0) {
        const existingEmails = existingEmailsResult.rows.map(
          (row) => row.email
        );
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Emails already exist in the database",
          details: existingEmails,
        });
      }
    }

    const results = [];
    const errors = [];
    let successCount = 0;

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        // Skip completely empty rows
        if (row.every((cell) => !cell || cell.trim() === "")) {
          continue;
        }

        const groupAdmin = {
          name: row[headers["name"]]?.trim(),
          email: row[headers["email"]]?.trim(),
          phone: row[headers["phone"]]?.trim(),
          password: row[headers["password"]]?.trim(),
          gender: row[headers["gender"]]?.trim().toLowerCase(),
        };

        // Validate required fields
        const validationErrors = [];
        if (!groupAdmin.name) validationErrors.push("Name is required");
        if (!groupAdmin.email) validationErrors.push("Email is required");
        else if (!emailRegex.test(groupAdmin.email))
          validationErrors.push("Invalid email format");
        if (!groupAdmin.password) validationErrors.push("Password is required");
        else if (groupAdmin.password.length < 8)
          validationErrors.push("Password must be at least 8 characters");
        if (!groupAdmin.gender) validationErrors.push("Gender is required");
        else {
          const validGenders = ["male", "female", "other"];
          if (!validGenders.includes(groupAdmin.gender)) {
            validationErrors.push("Gender must be male, female, or other");
          }
        }

        if (validationErrors.length > 0) {
          errors.push({
            row: i + 1,
            error: validationErrors.join("; "),
            email: groupAdmin.email || "N/A",
          });
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
            req.user?.id,
          ]
        );

        results.push(result.rows[0]);
        successCount++;
      } catch (error: any) {
        console.error(`Error processing row ${i + 1}:`, error);

        let errorMessage = "Failed to create group admin";

        // PostgreSQL error codes
        if (error.code) {
          switch (error.code) {
            case "23505": // unique_violation
              errorMessage = "Email already exists";
              break;
            case "23503": // foreign_key_violation
              errorMessage = "Invalid reference (foreign key violation)";
              break;
            case "23502": // not_null_violation
              errorMessage = "Missing required field";
              break;
            case "22001": // string_data_right_truncation
              errorMessage = "Data too long for column";
              break;
            default:
              errorMessage = `Database error: ${error.code}`;
          }
        }

        // Include the original error detail if available
        if (error.detail) {
          errorMessage += ` - ${error.detail}`;
        }

        errors.push({
          row: i + 1,
          error: errorMessage,
          email: row[headers["email"]]?.trim() || "N/A",
        });
      }
    }

    if (successCount > 0) {
      await client.query("COMMIT");
      res.status(201).json({
        success: results,
        errors,
        summary: {
          total: parsedRows.length - 1,
          success: successCount,
          failed: errors.length,
        },
      });
    } else if (errors.length > 0) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: "Failed to create any group admins",
        errors,
        summary: {
          total: parsedRows.length - 1,
          success: 0,
          failed: errors.length,
        },
      });
    } else {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "No valid data found in the CSV file" });
    }
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in bulk create:', error);
    res.status(500).json({ 
      error: 'Failed to process bulk creation',
      details: error.message || 'Unknown server error'
    });
  } finally {
    client.release();
  }
});

export default router; 