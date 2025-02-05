import express, { Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware, managementMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

// Initialize default leave types and policies
const initializeDefaultLeaveTypes = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Default leave types
    const defaultLeaveTypes = [
      {
        name: 'Privilege/Earned Leave (PL/EL)',
        description: 'Accrues monthly for planned vacations or personal time off',
        requires_documentation: false,
        max_days: 18,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Casual Leave (CL)',
        description: 'For urgent or unforeseen personal matters',
        requires_documentation: false,
        max_days: 12,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Sick Leave (SL)',
        description: 'For health-related absences',
        requires_documentation: true,
        max_days: 12,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Maternity Leave (ML)',
        description: 'For pre- and post-natal care',
        requires_documentation: true,
        max_days: 90,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Child Care Leave',
        description: 'For childcare responsibilities',
        requires_documentation: false,
        max_days: 15,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Child Adoption Leave',
        description: 'For adoptive parents',
        requires_documentation: true,
        max_days: 90,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Compensatory Off',
        description: 'Granted in lieu of extra hours worked',
        requires_documentation: false,
        max_days: 0,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Marriage Leave',
        description: 'For employee\'s own wedding',
        requires_documentation: true,
        max_days: 5,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Paternity Leave',
        description: 'For male employees following child birth',
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Bereavement Leave',
        description: 'Upon death of immediate family member',
        requires_documentation: true,
        max_days: 5,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Leave Without Pay (LWP)',
        description: 'Unpaid leave beyond allocated quota',
        requires_documentation: false,
        max_days: 0,
        is_paid: false,
        is_active: true
      },
      {
        name: 'Sabbatical Leave',
        description: 'Extended leave after long service',
        requires_documentation: true,
        max_days: 180,
        is_paid: false,
        is_active: true
      },
      {
        name: 'Half Pay Leave (HPL)',
        description: 'Leave with half salary',
        requires_documentation: false,
        max_days: 20,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Commuted Leave',
        description: 'Conversion of half pay leave to full pay',
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Leave Not Due (LND)',
        description: 'Advance leave against future accruals',
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true
      },
      {
        name: 'Special Casual Leave (SCL)',
        description: 'For specific purposes like blood donation, sports events',
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true
      }
    ];

    // Insert leave types and store their IDs
    const leaveTypeIds: { [key: string]: number } = {};
    for (const type of defaultLeaveTypes) {
      const result = await client.query(
        `INSERT INTO leave_types 
         (name, description, requires_documentation, max_days, is_paid, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (name) DO UPDATE 
         SET description = EXCLUDED.description,
             requires_documentation = EXCLUDED.requires_documentation,
             max_days = EXCLUDED.max_days,
             is_paid = EXCLUDED.is_paid,
             is_active = EXCLUDED.is_active
         RETURNING id`,
        [type.name, type.description, type.requires_documentation, type.max_days, type.is_paid, type.is_active]
      );
      leaveTypeIds[type.name] = result.rows[0].id;
    }

    // Default leave policies
    const defaultPolicies = [
      {
        leave_type: 'Privilege/Earned Leave (PL/EL)',
        default_days: 18,
        carry_forward_days: 30,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 15,
        gender_specific: null
      },
      {
        leave_type: 'Casual Leave (CL)',
        default_days: 12,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 1,
        max_consecutive_days: 3,
        gender_specific: null
      },
      {
        leave_type: 'Sick Leave (SL)',
        default_days: 12,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 0,
        max_consecutive_days: 5,
        gender_specific: null
      },
      {
        leave_type: 'Maternity Leave (ML)',
        default_days: 90,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 30,
        max_consecutive_days: 90,
        gender_specific: 'female'
      },
      {
        leave_type: 'Child Care Leave',
        default_days: 15,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 15,
        gender_specific: null
      },
      {
        leave_type: 'Child Adoption Leave',
        default_days: 90,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 30,
        max_consecutive_days: 90,
        gender_specific: null
      },
      {
        leave_type: 'Compensatory Off',
        default_days: 0,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 1,
        max_consecutive_days: 2,
        gender_specific: null
      },
      {
        leave_type: 'Marriage Leave',
        default_days: 5,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 15,
        max_consecutive_days: 5,
        gender_specific: null
      },
      {
        leave_type: 'Paternity Leave',
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 15,
        max_consecutive_days: 10,
        gender_specific: 'male'
      },
      {
        leave_type: 'Bereavement Leave',
        default_days: 5,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 0,
        max_consecutive_days: 5,
        gender_specific: null
      },
      {
        leave_type: 'Leave Without Pay (LWP)',
        default_days: 0,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 30,
        gender_specific: null
      },
      {
        leave_type: 'Sabbatical Leave',
        default_days: 180,
        carry_forward_days: 0,
        min_service_days: 2555, // 7 years
        requires_approval: true,
        notice_period_days: 90,
        max_consecutive_days: 180,
        gender_specific: null
      },
      {
        leave_type: 'Half Pay Leave (HPL)',
        default_days: 20,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 20,
        gender_specific: null
      },
      {
        leave_type: 'Commuted Leave',
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 10,
        gender_specific: null
      },
      {
        leave_type: 'Leave Not Due (LND)',
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 365,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 10,
        gender_specific: null
      },
      {
        leave_type: 'Special Casual Leave (SCL)',
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 3,
        max_consecutive_days: 5,
        gender_specific: null
      }
    ];

    // Insert leave policies
    for (const policy of defaultPolicies) {
      await client.query(
        `INSERT INTO leave_policies 
         (leave_type_id, default_days, carry_forward_days, min_service_days,
          requires_approval, notice_period_days, max_consecutive_days,
          gender_specific, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (leave_type_id) DO UPDATE 
         SET default_days = EXCLUDED.default_days,
             carry_forward_days = EXCLUDED.carry_forward_days,
             min_service_days = EXCLUDED.min_service_days,
             requires_approval = EXCLUDED.requires_approval,
             notice_period_days = EXCLUDED.notice_period_days,
             max_consecutive_days = EXCLUDED.max_consecutive_days,
             gender_specific = EXCLUDED.gender_specific,
             is_active = true`,
        [
          leaveTypeIds[policy.leave_type],
          policy.default_days,
          policy.carry_forward_days,
          policy.min_service_days,
          policy.requires_approval,
          policy.notice_period_days,
          policy.max_consecutive_days,
          policy.gender_specific
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing default leave types:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Initialize defaults on server start
initializeDefaultLeaveTypes().catch(console.error);

// Check and initialize defaults route
router.post('/initialize-defaults', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    await initializeDefaultLeaveTypes();
    res.json({ message: 'Default leave types and policies initialized successfully' });
  } catch (error) {
    console.error('Error initializing defaults:', error);
    res.status(500).json({ error: 'Failed to initialize defaults' });
  }
});

// Get all leave types
router.get('/leave-types', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leave_types ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ error: 'Failed to fetch leave types' });
  }
});

// Create new leave type
router.post('/leave-types', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const {
      name,
      description,
      requires_documentation,
      max_days,
      is_paid,
      is_active
    } = req.body;

    const result = await pool.query(
      `INSERT INTO leave_types 
       (name, description, requires_documentation, max_days, is_paid, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, requires_documentation, max_days, is_paid, is_active]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating leave type:', error);
    res.status(500).json({ error: 'Failed to create leave type' });
  }
});

// Update leave type
router.put('/leave-types/:id', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      requires_documentation,
      max_days,
      is_paid,
      is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE leave_types 
       SET name = $1,
           description = $2,
           requires_documentation = $3,
           max_days = $4,
           is_paid = $5,
           is_active = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name, description, requires_documentation, max_days, is_paid, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Leave type not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating leave type:', error);
    res.status(500).json({ error: 'Failed to update leave type' });
  }
});

// Get all leave policies
router.get('/leave-policies', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT lp.*, lt.name as leave_type_name
       FROM leave_policies lp
       JOIN leave_types lt ON lp.leave_type_id = lt.id
       ORDER BY lp.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave policies:', error);
    res.status(500).json({ error: 'Failed to fetch leave policies' });
  }
});

// Create new leave policy
router.post('/leave-policies', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const {
      leave_type_id,
      default_days,
      carry_forward_days,
      min_service_days,
      requires_approval,
      notice_period_days,
      max_consecutive_days,
      gender_specific,
      is_active,
      rules
    } = req.body;

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert the policy
      const policyResult = await client.query(
        `INSERT INTO leave_policies 
         (leave_type_id, default_days, carry_forward_days, min_service_days,
          requires_approval, notice_period_days, max_consecutive_days,
          gender_specific, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [leave_type_id, default_days, carry_forward_days, min_service_days,
         requires_approval, notice_period_days, max_consecutive_days,
         gender_specific, is_active]
      );

      // Insert rules if provided
      if (rules && rules.length > 0) {
        for (const rule of rules) {
          await client.query(
            `INSERT INTO leave_policy_rules 
             (policy_id, rule_type, rule_value)
             VALUES ($1, $2, $3)`,
            [policyResult.rows[0].id, rule.type, rule.value]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json(policyResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating leave policy:', error);
    res.status(500).json({ error: 'Failed to create leave policy' });
  }
});

// Update leave policy
router.put('/leave-policies/:id', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      default_days,
      carry_forward_days,
      min_service_days,
      requires_approval,
      notice_period_days,
      max_consecutive_days,
      gender_specific,
      is_active,
      rules
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update the policy
      const result = await client.query(
        `UPDATE leave_policies 
         SET default_days = $1,
             carry_forward_days = $2,
             min_service_days = $3,
             requires_approval = $4,
             notice_period_days = $5,
             max_consecutive_days = $6,
             gender_specific = $7,
             is_active = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [default_days, carry_forward_days, min_service_days,
         requires_approval, notice_period_days, max_consecutive_days,
         gender_specific, is_active, id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Leave policy not found' });
      }

      // Update rules if provided
      if (rules) {
        // Delete existing rules
        await client.query('DELETE FROM leave_policy_rules WHERE policy_id = $1', [id]);
        
        // Insert new rules
        for (const rule of rules) {
          await client.query(
            `INSERT INTO leave_policy_rules 
             (policy_id, rule_type, rule_value)
             VALUES ($1, $2, $3)`,
            [id, rule.type, rule.value]
          );
        }
      }

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating leave policy:', error);
    res.status(500).json({ error: 'Failed to update leave policy' });
  }
});

// Get leave analytics
router.get('/analytics', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    // Get overall statistics
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_requests,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
         COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests
       FROM leave_requests
       WHERE created_at BETWEEN $1 AND $2`,
      [start_date, end_date]
    );

    // Get leave type distribution
    const typeDistribution = await pool.query(
      `SELECT 
         lt.name as leave_type,
         COUNT(*) as request_count
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.created_at BETWEEN $1 AND $2
       GROUP BY lt.name`,
      [start_date, end_date]
    );

    // Get daily trend
    const trend = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as request_count
       FROM leave_requests
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [start_date, end_date]
    );

    res.json({
      statistics: statsResult.rows[0],
      typeDistribution: typeDistribution.rows,
      trend: trend.rows
    });
  } catch (error) {
    console.error('Error fetching leave analytics:', error);
    res.status(500).json({ error: 'Failed to fetch leave analytics' });
  }
});

export default router; 