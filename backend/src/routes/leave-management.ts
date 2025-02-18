import express, { Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware, managementMiddleware } from '../middleware/auth';
import { CustomRequest } from '../types';

const router = express.Router();

interface DefaultLeavePolicy {
  leave_type: string;
  default_days: number;
  carry_forward_days: number;
  min_service_days: number;
  requires_approval: boolean;
  notice_period_days: number;
  max_consecutive_days: number;
  gender_specific: string | null;
}

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
    const defaultPolicies: DefaultLeavePolicy[] = [
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
        notice_period_days: 7,
        max_consecutive_days: 10,
        gender_specific: null
      }
    ];

    // Insert leave policies
    for (const policy of defaultPolicies) {
      if (!policy.leave_type || !leaveTypeIds[policy.leave_type]) {
        console.error(`Invalid leave type: ${policy.leave_type}`);
        continue;
      }
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

    // Validate gender_specific value
    if (gender_specific && !['male', 'female'].includes(gender_specific)) {
      return res.status(400).json({ 
        error: 'Invalid Value',
        details: 'Gender specific value must be either "male", "female", or null'
      });
    }

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
    // Default to last 30 days if no dates provided
    const defaultStartDate = new Date();
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);
    
    let startDate = req.query.start_date ? new Date(req.query.start_date as string) : defaultStartDate;
    let endDate = req.query.end_date ? new Date(req.query.end_date as string) : new Date();

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format',
        details: 'Please provide dates in YYYY-MM-DD format'
      });
    }

    // Ensure we have the user ID
    if (!req.user?.id) {
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'User ID not found'
      });
    }

    // Get all users under management's company
    const usersQuery = `
      SELECT array_agg(id) as user_ids
      FROM users
      WHERE company_id = (
        SELECT company_id 
        FROM users 
        WHERE id = $1
      )
      AND role IN ('employee', 'group-admin');
    `;

    const usersResult = await pool.query(usersQuery, [req.user.id]);
    const userIds = usersResult.rows[0]?.user_ids || [];

    if (userIds.length === 0) {
      return res.json({
        statistics: {
          total_requests: 0,
          approved_requests: 0,
          pending_requests: 0,
          rejected_requests: 0
        },
        typeDistribution: [],
        trend: []
      });
    }

    // Get overall statistics
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_requests,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
         COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests
       FROM leave_requests lr
       WHERE lr.user_id = ANY($1)
       AND lr.created_at BETWEEN $2 AND $3`,
      [userIds, startDate.toISOString(), endDate.toISOString()]
    );

    // Get leave type distribution
    const typeDistribution = await pool.query(
      `SELECT 
         lt.name as leave_type,
         COUNT(*) as request_count
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.user_id = ANY($1)
       AND lr.created_at BETWEEN $2 AND $3
       GROUP BY lt.name, lt.id
       ORDER BY request_count DESC`,
      [userIds, startDate.toISOString(), endDate.toISOString()]
    );

    // Get daily trend with proper date handling
    const trend = await pool.query(
      `WITH RECURSIVE dates AS (
         SELECT date_trunc('day', $1::timestamp)::date as date
         UNION ALL
         SELECT (date + interval '1 day')::date
         FROM dates
         WHERE date < date_trunc('day', $2::timestamp)::date
       ),
       daily_counts AS (
         SELECT 
           date_trunc('day', created_at)::date as date,
           COUNT(*) as request_count
         FROM leave_requests
         WHERE user_id = ANY($3)
         AND created_at BETWEEN $1 AND $2
         GROUP BY date_trunc('day', created_at)::date
       )
       SELECT 
         to_char(d.date, 'YYYY-MM-DD') as date,
         COALESCE(dc.request_count, 0) as request_count
       FROM dates d
       LEFT JOIN daily_counts dc ON d.date = dc.date
       ORDER BY d.date`,
      [startDate.toISOString(), endDate.toISOString(), userIds]
    );

    const response = {
      statistics: {
        total_requests: parseInt(statsResult.rows[0]?.total_requests || '0'),
        approved_requests: parseInt(statsResult.rows[0]?.approved_requests || '0'),
        pending_requests: parseInt(statsResult.rows[0]?.pending_requests || '0'),
        rejected_requests: parseInt(statsResult.rows[0]?.rejected_requests || '0')
      },
      typeDistribution: typeDistribution.rows || [],
      trend: trend.rows || []
    };

    console.log('Analytics Response:', JSON.stringify(response, null, 2)); // Debug log
    res.json(response);
  } catch (error) {
    console.error('Error in analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Calculate and initialize leave balances for a user
export const calculateLeaveBalances = async (userId: number, year: number) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all active leave types and their policies
    const leaveTypesResult = await client.query(`
      SELECT lt.*, lp.default_days, lp.carry_forward_days
      FROM leave_types lt
      JOIN leave_policies lp ON lt.id = lp.leave_type_id
      WHERE lt.is_active = true AND lp.is_active = true
    `);

    // Get previous year's balances for carry forward calculation
    const prevYearBalances = await client.query(`
      SELECT leave_type_id, (total_days - used_days) as remaining_days
      FROM leave_balances
      WHERE user_id = $1 AND year = $2
    `, [userId, year - 1]);

    const prevBalancesMap = prevYearBalances.rows.reduce((acc, row) => {
      acc[row.leave_type_id] = row.remaining_days;
      return acc;
    }, {});

    // Calculate and upsert balances for each leave type
    for (const leaveType of leaveTypesResult.rows) {
      const carryForwardDays = Math.min(
        prevBalancesMap[leaveType.id] || 0,
        leaveType.carry_forward_days
      );

      const totalDays = leaveType.default_days + carryForwardDays;

      await client.query(`
        INSERT INTO leave_balances (
          user_id, leave_type_id, total_days, used_days, pending_days, year
        )
        VALUES ($1, $2, $3, 0, 0, $4)
        ON CONFLICT (user_id, leave_type_id, year)
        DO UPDATE SET
          total_days = $3,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, leaveType.id, totalDays, year]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Helper function to get users under management
const getUsersUnderManagement = async (managementId: number) => {
  const result = await pool.query(
    `WITH RECURSIVE user_hierarchy AS (
      -- Get direct group admins under management
      SELECT id, name, email, role, company_id, group_admin_id, employee_number
      FROM users
      WHERE company_id = (SELECT company_id FROM users WHERE id = $1)
      AND (
        -- Include the management user themselves
        id = $1
        -- Include group admins directly under management
        OR (role = 'group-admin' AND company_id = (SELECT company_id FROM users WHERE id = $1))
      )
      
      UNION
      
      -- Get employees under these group admins
      SELECT u.id, u.name, u.email, u.role, u.company_id, u.group_admin_id, u.employee_number
      FROM users u
      INNER JOIN user_hierarchy uh ON u.group_admin_id = uh.id
      WHERE u.role = 'employee'
    )
    SELECT DISTINCT id, name, email, role, employee_number
    FROM user_hierarchy
    ORDER BY role, name`,
    [managementId]
  );
  return result.rows;
};

// Get users for leave management
router.get('/users', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const users = await getUsersUnderManagement(Number(userId));
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update leave balance endpoint to check user access
router.get('/leave-balances/:userId', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const managementId = req.user?.id;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    if (!managementId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if the requested user is under this management's hierarchy
    const allowedUsers = await getUsersUnderManagement(Number(managementId));
    const isAllowed = allowedUsers.some(user => user.id === userId);

    if (!isAllowed) {
      return res.status(403).json({ error: 'Access denied to this user\'s leave balances' });
    }

    // Calculate balances if they don't exist
    await calculateLeaveBalances(userId, year);

    // Get the calculated balances
    const result = await pool.query(`
      SELECT 
        lb.*,
        lt.name as leave_type_name,
        lt.description as leave_type_description,
        lt.is_paid
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = $1 AND lb.year = $2
      ORDER BY lt.name
    `, [userId, year]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave balances:', error);
    res.status(500).json({ error: 'Failed to fetch leave balances' });
  }
});

// Update leave balance when a leave request is processed
const updateLeaveBalance = async (
  userId: number,
  leaveTypeId: number,
  days: number,
  status: 'pending' | 'approved' | 'rejected',
  year: number
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (status === 'pending') {
      await client.query(`
        UPDATE leave_balances
        SET pending_days = pending_days + $1
        WHERE user_id = $2 AND leave_type_id = $3 AND year = $4
      `, [days, userId, leaveTypeId, year]);
    } else if (status === 'approved') {
      await client.query(`
        UPDATE leave_balances
        SET used_days = used_days + $1,
            pending_days = pending_days - $1
        WHERE user_id = $2 AND leave_type_id = $3 AND year = $4
      `, [days, userId, leaveTypeId, year]);
    } else if (status === 'rejected') {
      await client.query(`
        UPDATE leave_balances
        SET pending_days = pending_days - $1
        WHERE user_id = $2 AND leave_type_id = $3 AND year = $4
      `, [days, userId, leaveTypeId, year]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Process year-end leave balance calculations
router.post('/process-year-end', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    // Get all users
    const usersResult = await client.query('SELECT id FROM users WHERE role != \'super-admin\'');

    for (const user of usersResult.rows) {
      await calculateLeaveBalances(user.id, nextYear);
    }

    await client.query('COMMIT');
    res.json({ message: 'Year-end leave balances processed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing year-end balances:', error);
    res.status(500).json({ error: 'Failed to process year-end balances' });
  } finally {
    client.release();
  }
});

// Get documents for a leave request
router.get('/leave-requests/:id/documents', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;

    // Check if user has access to this leave request
    const accessCheck = await client.query(`
      SELECT 1
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1
      AND (
        lr.user_id = $2
        OR (u.group_admin_id = $2 AND $3 = 'group-admin')
        OR $3 = 'management'
      )`,
      [id, req.user.id, req.user.role]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await client.query(
      `SELECT id, file_name, file_type, file_data, upload_method, created_at
       FROM leave_documents
       WHERE request_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave request documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  } finally {
    client.release();
  }
});

// Update the leave request submission route to handle documents
router.post('/leave-requests', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      leave_type_id,
      start_date,
      end_date,
      reason,
      contact_number,
      documents
    } = req.body;

    await client.query('BEGIN');

    // Get leave type details and validate
    const leaveTypeResult = await client.query(
      `SELECT lt.*, lp.* 
       FROM leave_types lt
       JOIN leave_policies lp ON lt.id = lp.leave_type_id
       WHERE lt.id = $1 AND lt.is_active = true`,
      [leave_type_id]
    );

    if (leaveTypeResult.rows.length === 0) {
      throw new Error('Invalid or inactive leave type');
    }

    const leaveType = leaveTypeResult.rows[0];
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const requestedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;

    // Validate against policy
    if (requestedDays > leaveType.max_consecutive_days) {
      throw new Error(`Cannot request more than ${leaveType.max_consecutive_days} consecutive days`);
    }

    // Check if documentation is required but not provided
    if (leaveType.requires_documentation && (!documents || documents.length === 0)) {
      throw new Error('Documentation is required for this leave type');
    }

    // Check gender-specific leave types
    if (leaveType.gender_specific) {
      const userResult = await client.query(
        'SELECT gender FROM users WHERE id = $1',
        [req.user.id]
      );
      
      if (!userResult.rows[0]?.gender) {
        return res.status(400).json({
          error: 'Missing Information',
          details: 'User gender information is required for this type of leave'
        });
      }
      
      if (userResult.rows[0].gender !== leaveType.gender_specific) {
        return res.status(400).json({ 
          error: 'Not Eligible',
          details: `This leave type is only available for ${leaveType.gender_specific} employees`
        });
      }
    }

    // Get user's current leave balance
    const balanceResult = await client.query(
      `SELECT * FROM leave_balances 
       WHERE user_id = $1 AND leave_type_id = $2 AND year = $3`,
      [req.user.id, leave_type_id, new Date().getFullYear()]
    );

    if (balanceResult.rows.length === 0) {
      throw new Error('No leave balance found');
    }

    const balance = balanceResult.rows[0];
    const availableDays = balance.total_days - balance.used_days - balance.pending_days;

    if (requestedDays > availableDays) {
      throw new Error('Insufficient leave balance');
    }

    // Create leave request
    const requestResult = await client.query(
      `INSERT INTO leave_requests (
        user_id, leave_type_id, start_date, end_date, reason,
        contact_number, requires_documentation, has_documentation,
        status, days_requested
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        req.user.id, leave_type_id, start_date, end_date, reason,
        contact_number, leaveType.requires_documentation, documents && documents.length > 0,
        'pending', requestedDays
      ]
    );

    const requestId = requestResult.rows[0].id;

    // Save documents if provided
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        await client.query(
          `INSERT INTO leave_documents (
            request_id, file_name, file_type, file_data, upload_method
          ) VALUES ($1, $2, $3, $4, $5)`,
          [requestId, doc.file_name, doc.file_type, doc.file_data, doc.upload_method]
        );
      }
    }

    // Update leave balance
    await updateLeaveBalance(Number(req.user.id), leave_type_id, requestedDays, 'pending', new Date().getFullYear());

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Leave request submitted successfully',
      request_id: requestId
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error processing leave request:', error);
    res.status(400).json({ error: error.message || 'Failed to process leave request' });
  } finally {
    client.release();
  }
});

// Process leave request approval/rejection
router.post('/leave-requests/:id/:action', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id, action } = req.params;
    const { rejection_reason, escalate_to } = req.body;

    if (!['approve', 'reject', 'escalate'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await client.query('BEGIN');

    // Get leave request details
    const requestResult = await client.query(
      `SELECT lr.*, lt.name as leave_type_name, u.group_admin_id
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = $1`,
      [parseInt(id)]  // Convert id to number
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Leave request not found');
    }

    const request = requestResult.rows[0];

    // Verify authorization
    if (req.user?.role === 'group-admin' && request.group_admin_id !== req.user.id) {
      throw new Error('Not authorized to process this request');
    }

    if (action === 'escalate') {
      if (!escalate_to) {
        throw new Error('Escalation target is required');
      }

      // Create escalation record
      await client.query(
        `INSERT INTO leave_escalations (
          request_id, escalated_by, escalated_to, reason, status
        ) VALUES ($1, $2, $3, $4, 'pending')`,
        [id, req.user?.id, escalate_to, req.body.escalation_reason || 'Needs higher approval']
      );

      await client.query(
        `UPDATE leave_requests 
         SET status = 'escalated',
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
    } else {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // Update leave request status
      await client.query(
        `UPDATE leave_requests 
         SET status = $1,
         rejection_reason = $2,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newStatus, rejection_reason, id]
      );

      // Update leave balance
      await updateLeaveBalance(
        Number(request.user_id),
        Number(request.leave_type_id),
        Number(request.days_requested),  // Convert to number
        newStatus as 'pending' | 'approved' | 'rejected',
        new Date(request.start_date).getFullYear()
      );
    }

    await client.query('COMMIT');
    res.json({ 
      message: `Leave request ${action === 'escalate' ? 'escalated' : action + 'd'} successfully` 
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error processing leave request action:', error);
    res.status(400).json({ error: error.message || 'Failed to process leave request action' });
  } finally {
    client.release();
  }
});

// Get escalated leave requests
router.get('/escalated-requests', authMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
        lr.*,
        le.escalated_by,
        le.escalated_to,
        le.reason as escalation_reason,
        le.created_at as escalated_at,
        u.name as user_name,
        u.employee_number,
        lt.name as leave_type_name,
        eb.name as escalated_by_name,
        et.name as escalated_to_name
       FROM leave_requests lr
       JOIN leave_escalations le ON lr.id = le.request_id
       JOIN users u ON lr.user_id = u.id
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN users eb ON le.escalated_by = eb.id
       JOIN users et ON le.escalated_to = et.id
       WHERE le.escalated_to = $1 AND le.status = 'pending'
       ORDER BY le.created_at DESC`,
      [req.user?.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching escalated requests:', error);
    res.status(500).json({ error: 'Failed to fetch escalated requests' });
  }
});

// Get all leave requests for management
router.get('/leave-requests', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.query.user_id ? parseInt(req.query.user_id as string) : req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await pool.query(
      `SELECT 
        lr.*,
        lt.name as leave_type_name,
        u.name as user_name,
        u.employee_number,
        u.department
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      WHERE lr.user_id = $1
      ORDER BY lr.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// Get pending leave requests for management
router.get('/pending-requests', authMiddleware, managementMiddleware, async (req: CustomRequest, res: Response) => {
  try {
    const managerId = req.user?.id;
    
    if (!managerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get all users under this manager
    const usersUnderManager = await getUsersUnderManagement(Number(managerId));
    const userIds = usersUnderManager.map(user => user.id);

    if (userIds.length === 0) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT 
        lr.*,
        lt.name as leave_type_name,
        u.name as user_name,
        u.employee_number,
        u.department,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ld.id,
                'file_name', ld.file_name,
                'file_type', ld.file_type,
                'file_data', ld.file_data,
                'upload_method', ld.upload_method
              )
            )
            FROM leave_documents ld
            WHERE ld.request_id = lr.id
          ),
          '[]'
        ) as documents
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      WHERE lr.user_id = ANY($1::int[])
      AND lr.status = 'pending'
      ORDER BY lr.created_at DESC`,
      [userIds]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending leave requests' });
  }
});

// Add this new endpoint after other routes
router.get('/stats', authMiddleware, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    // Get pending and approved requests count
    const requestsResult = await client.query(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests
      FROM leave_requests
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    // Get active leave types count
    const leaveTypesResult = await client.query(`
      SELECT COUNT(*) as active_leave_types
      FROM leave_types
      WHERE is_active = true
    `);

    const stats = {
      pending_requests: parseInt(requestsResult.rows[0]?.pending_requests || '0'),
      approved_requests: parseInt(requestsResult.rows[0]?.approved_requests || '0'),
      active_leave_types: parseInt(leaveTypesResult.rows[0]?.active_leave_types || '0')
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching leave stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch leave stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

export default router; 