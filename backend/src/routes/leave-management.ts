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
const initializeDefaultLeaveTypes = async (companyId?: number) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Default leave types
    const defaultLeaveTypes = [
      {
        name: "Privilege/Earned Leave (PL/EL)",
        description:
          "Accrues monthly for planned vacations or personal time off",
        requires_documentation: false,
        max_days: 18,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Casual Leave (CL)",
        description: "For urgent or unforeseen personal matters",
        requires_documentation: false,
        max_days: 12,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Sick Leave (SL)",
        description: "For health-related absences",
        requires_documentation: true,
        max_days: 12,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Maternity Leave (ML)",
        description: "For pre- and post-natal care",
        requires_documentation: true,
        max_days: 90,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Child Care Leave",
        description: "For childcare responsibilities",
        requires_documentation: false,
        max_days: 15,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Child Adoption Leave",
        description: "For adoptive parents",
        requires_documentation: true,
        max_days: 90,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Compensatory Off",
        description: "Granted in lieu of extra hours worked",
        requires_documentation: false,
        max_days: 0,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Marriage Leave",
        description: "For employee's own wedding",
        requires_documentation: true,
        max_days: 5,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Paternity Leave",
        description: "For male employees following child birth",
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Bereavement Leave",
        description: "Upon death of immediate family member",
        requires_documentation: true,
        max_days: 5,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Leave Without Pay (LWP)",
        description: "Unpaid leave beyond allocated quota",
        requires_documentation: false,
        max_days: 0,
        is_paid: false,
        is_active: true,
      },
      {
        name: "Sabbatical Leave",
        description: "Extended leave after long service",
        requires_documentation: true,
        max_days: 180,
        is_paid: false,
        is_active: true,
      },
      {
        name: "Half Pay Leave (HPL)",
        description: "Leave with half salary",
        requires_documentation: false,
        max_days: 20,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Commuted Leave",
        description: "Conversion of half pay leave to full pay",
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Leave Not Due (LND)",
        description: "Advance leave against future accruals",
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Special Casual Leave (SCL)",
        description: "For specific purposes like blood donation, sports events",
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true,
      },
    ];

    // Insert leave types and store their IDs
    const leaveTypeIds: { [key: string]: number } = {};
    for (const type of defaultLeaveTypes) {
      let query, params;

      if (companyId) {
        // Creating company-specific defaults
        query = `
          INSERT INTO leave_types 
          (name, description, requires_documentation, max_days, is_paid, is_active, company_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (name, company_id) DO UPDATE 
          SET description = EXCLUDED.description,
              requires_documentation = EXCLUDED.requires_documentation,
              max_days = EXCLUDED.max_days,
              is_paid = EXCLUDED.is_paid,
              is_active = EXCLUDED.is_active
          RETURNING id`;
        params = [
          type.name,
          type.description,
          type.requires_documentation,
          type.max_days,
          type.is_paid,
          type.is_active,
          companyId,
        ];
      } else {
        // Creating global defaults
        query = `
          INSERT INTO leave_types 
          (name, description, requires_documentation, max_days, is_paid, is_active, company_id)
          VALUES ($1, $2, $3, $4, $5, $6, NULL)
          ON CONFLICT (name) WHERE company_id IS NULL DO UPDATE 
          SET description = EXCLUDED.description,
              requires_documentation = EXCLUDED.requires_documentation,
              max_days = EXCLUDED.max_days,
              is_paid = EXCLUDED.is_paid,
              is_active = EXCLUDED.is_active
          RETURNING id`;
        params = [
          type.name,
          type.description,
          type.requires_documentation,
          type.max_days,
          type.is_paid,
          type.is_active,
        ];
      }

      const result = await client.query(query, params);
      leaveTypeIds[type.name] = result.rows[0].id;
    }

    // Default leave policies
    const defaultPolicies: DefaultLeavePolicy[] = [
      {
        leave_type: "Privilege/Earned Leave (PL/EL)",
        default_days: 18,
        carry_forward_days: 30,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 15,
        gender_specific: null,
      },
      {
        leave_type: "Casual Leave (CL)",
        default_days: 12,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 1,
        max_consecutive_days: 3,
        gender_specific: null,
      },
      {
        leave_type: "Sick Leave (SL)",
        default_days: 12,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 0,
        max_consecutive_days: 5,
        gender_specific: null,
      },
      {
        leave_type: "Maternity Leave (ML)",
        default_days: 90,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 30,
        max_consecutive_days: 90,
        gender_specific: "female",
      },
      {
        leave_type: "Child Care Leave",
        default_days: 15,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 15,
        gender_specific: null,
      },
      {
        leave_type: "Child Adoption Leave",
        default_days: 90,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 30,
        max_consecutive_days: 90,
        gender_specific: null,
      },
      {
        leave_type: "Compensatory Off",
        default_days: 0,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 1,
        max_consecutive_days: 2,
        gender_specific: null,
      },
      {
        leave_type: "Marriage Leave",
        default_days: 5,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 15,
        max_consecutive_days: 5,
        gender_specific: null,
      },
      {
        leave_type: "Paternity Leave",
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 15,
        max_consecutive_days: 10,
        gender_specific: "male",
      },
      {
        leave_type: "Bereavement Leave",
        default_days: 5,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 0,
        max_consecutive_days: 5,
        gender_specific: null,
      },
      {
        leave_type: "Leave Without Pay (LWP)",
        default_days: 0,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 30,
        gender_specific: null,
      },
      {
        leave_type: "Sabbatical Leave",
        default_days: 180,
        carry_forward_days: 0,
        min_service_days: 2555, // 7 years
        requires_approval: true,
        notice_period_days: 90,
        max_consecutive_days: 180,
        gender_specific: null,
      },
      {
        leave_type: "Half Pay Leave (HPL)",
        default_days: 20,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 20,
        gender_specific: null,
      },
      {
        leave_type: "Commuted Leave",
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 10,
        gender_specific: null,
      },
      {
        leave_type: "Leave Not Due (LND)",
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 365,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 10,
        gender_specific: null,
      },
      {
        leave_type: "Special Casual Leave (SCL)",
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 10,
        gender_specific: null,
      },
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
          policy.gender_specific,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error initializing default leave types:", error);
    throw error;
  } finally {
    client.release();
  }
};

// Initialize defaults on server start - for global defaults
initializeDefaultLeaveTypes().catch(console.error);
console.log("Default leave types and policies initialized successfully");

// Check and initialize defaults route for company-specific defaults
router.post(
  "/initialize-defaults",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get the company_id of the requesting user
      const userResult = await pool.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      const companyId = userResult.rows[0]?.company_id;

      if (!companyId) {
        return res
          .status(400)
          .json({ error: "User not associated with any company" });
      }

      await initializeDefaultLeaveTypes(companyId);
      res.json({
        message:
          "Default leave types and policies initialized successfully for your company",
      });
    } catch (error) {
      console.error("Error initializing defaults:", error);
      res.status(500).json({ error: "Failed to initialize defaults" });
    }
  }
);

// Get all leave types
router.get(
  "/leave-types",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get the company_id of the requesting user
      const userResult = await pool.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      const companyId = userResult.rows[0]?.company_id;

      if (!companyId) {
        return res
          .status(400)
          .json({ error: "User not associated with any company" });
      }

      // Get both global leave types (company_id is NULL) and company-specific leave types
      const result = await pool.query(
        `SELECT * FROM leave_types 
       WHERE company_id IS NULL OR company_id = $1
       ORDER BY created_at DESC`,
        [companyId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching leave types:", error);
      res.status(500).json({ error: "Failed to fetch leave types" });
    }
  }
);

// Create new leave type
router.post(
  "/leave-types",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    try {
      const {
        name,
        description,
        requires_documentation,
        max_days,
        is_paid,
        is_active,
      } = req.body;

      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get the company_id of the requesting user
      const userResult = await pool.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      const companyId = userResult.rows[0]?.company_id;

      if (!companyId) {
        return res
          .status(400)
          .json({ error: "User not associated with any company" });
      }

      // Note: max_days represents the maximum possible days allowed for this leave type
      // The actual allocation is determined by leave_policies.default_days
      const result = await pool.query(
        `INSERT INTO leave_types 
       (name, description, requires_documentation, max_days, is_paid, is_active, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
        [
          name,
          description,
          requires_documentation,
          max_days,
          is_paid,
          is_active,
          companyId,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating leave type:", error);
      res.status(500).json({ error: "Failed to create leave type" });
    }
  }
);

// Update leave type
router.put(
  "/leave-types/:id",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        requires_documentation,
        max_days, // This is the maximum possible days for this leave type
        is_paid,
        is_active,
      } = req.body;

      // Validate input
      if (!name) {
        return res.status(400).json({ error: "Leave type name is required" });
      }

      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get the company_id of the requesting user
      const userResult = await pool.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      const companyId = userResult.rows[0]?.company_id;

      if (!companyId) {
        return res
          .status(400)
          .json({ error: "User not associated with any company" });
      }

      // First check if this is a global leave type
      const globalCheck = await pool.query(
        `SELECT * FROM leave_types WHERE id = $1 AND company_id IS NULL`,
        [id]
      );

      // If this is a global leave type, create a company-specific copy
      if (globalCheck.rows.length > 0) {
        // Check if a leave type with this name already exists for this company
        const existingType = await pool.query(
          `SELECT * FROM leave_types WHERE name = $1 AND company_id = $2`,
          [name, companyId]
        );

        if (existingType.rows.length > 0) {
          // If a company-specific leave type already exists, update it
          const result = await pool.query(
            `UPDATE leave_types SET 
               description = $1,
               requires_documentation = $2,
               max_days = $3, -- Maximum possible days for this leave type (serves as upper limit for leave_policies.default_days)
               is_paid = $4,
               is_active = $5,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [
              description,
              requires_documentation,
              max_days,
              is_paid,
              is_active,
              existingType.rows[0].id,
            ]
          );

          // Check if a leave policy exists for this leave type
          const policyCheck = await pool.query(
            `SELECT * FROM leave_policies WHERE leave_type_id = $1`,
            [existingType.rows[0].id]
          );

          if (policyCheck.rows.length === 0) {
            // Create a new leave policy for this company-specific leave type
            const globalPolicy = await pool.query(
              `SELECT * FROM leave_policies WHERE leave_type_id = $1`,
              [id]
            );

            if (globalPolicy.rows.length > 0) {
              // Copy policy settings from the global policy
              // Ensure default_days doesn't exceed max_days
              const default_days = Math.min(
                globalPolicy.rows[0].default_days,
                max_days
              );

              await pool.query(
                `INSERT INTO leave_policies
                 (leave_type_id, default_days, carry_forward_days, min_service_days,
                  requires_approval, notice_period_days, max_consecutive_days,
                  gender_specific, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  existingType.rows[0].id,
                  default_days,
                  globalPolicy.rows[0].carry_forward_days,
                  globalPolicy.rows[0].min_service_days,
                  globalPolicy.rows[0].requires_approval,
                  globalPolicy.rows[0].notice_period_days,
                  globalPolicy.rows[0].max_consecutive_days,
                  globalPolicy.rows[0].gender_specific,
                  globalPolicy.rows[0].is_active,
                ]
              );
            }
          } else {
            // Update the existing policy to ensure default_days doesn't exceed max_days
            const default_days = Math.min(
              policyCheck.rows[0].default_days,
              max_days
            );

            await pool.query(
              `UPDATE leave_policies
               SET default_days = $1
               WHERE leave_type_id = $2`,
              [default_days, existingType.rows[0].id]
            );
          }

          return res.json({
            ...result.rows[0],
            message: "Updated company-specific copy of global leave type",
          });
        }

        // Create a company-specific copy of the global leave type
        const result = await pool.query(
          `INSERT INTO leave_types 
           (name, description, requires_documentation, max_days, is_paid, is_active, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            name,
            description,
            requires_documentation,
            max_days,
            is_paid,
            is_active,
            companyId,
          ]
        );

        // Check if a leave policy exists for the global leave type
        const globalPolicy = await pool.query(
          `SELECT * FROM leave_policies WHERE leave_type_id = $1`,
          [id]
        );

        if (globalPolicy.rows.length > 0) {
          // Copy policy settings from the global policy
          // Ensure default_days doesn't exceed max_days
          const default_days = Math.min(
            globalPolicy.rows[0].default_days,
            max_days
          );

          await pool.query(
            `INSERT INTO leave_policies
             (leave_type_id, default_days, carry_forward_days, min_service_days,
              requires_approval, notice_period_days, max_consecutive_days,
              gender_specific, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              result.rows[0].id,
              default_days,
              globalPolicy.rows[0].carry_forward_days,
              globalPolicy.rows[0].min_service_days,
              globalPolicy.rows[0].requires_approval,
              globalPolicy.rows[0].notice_period_days,
              globalPolicy.rows[0].max_consecutive_days,
              globalPolicy.rows[0].gender_specific,
              globalPolicy.rows[0].is_active,
            ]
          );
        }

        return res.json({
          ...result.rows[0],
          message: "Created company-specific copy of global leave type",
        });
      }

      // Check if this leave type belongs to this company
      const checkType = await pool.query(
        `SELECT * FROM leave_types WHERE id = $1`,
        [id]
      );

      if (
        checkType.rows.length === 0 ||
        checkType.rows[0].company_id !== companyId
      ) {
        return res.status(403).json({
          error: "You don't have permission to modify this leave type",
        });
      }

      // Update the leave type
      const result = await pool.query(
        `UPDATE leave_types
         SET name = $1, 
             description = $2,
             requires_documentation = $3,
             max_days = $4, -- Max possible days for this leave type (serves as upper limit for default_days in policies)
             is_paid = $5,
             is_active = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [
          name,
          description,
          requires_documentation,
          max_days,
          is_paid,
          is_active,
          id,
        ]
      );

      // If max_days was reduced, ensure no policy has default_days higher than max_days
      await pool.query(
        `UPDATE leave_policies 
         SET default_days = LEAST(default_days, $1) 
         WHERE leave_type_id = $2`,
        [max_days, id]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating leave type:", error);
      res.status(500).json({ error: "Failed to update leave type" });
    }
  }
);

// Get all leave policies
router.get(
  "/leave-policies",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get the company_id of the requesting user
      const userResult = await pool.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      const companyId = userResult.rows[0]?.company_id;

      if (!companyId) {
        return res
          .status(400)
          .json({ error: "User not associated with any company" });
      }

      // Get both global policies and company-specific policies
      const result = await pool.query(
        `SELECT 
           lp.*,
           lt.name as leave_type_name,
           lt.company_id,
           CASE WHEN lt.company_id IS NULL THEN true ELSE false END as is_global_policy,
           CASE 
             WHEN lt.company_id IS NULL THEN 
               (SELECT COUNT(*) > 0 FROM leave_types 
                WHERE name = lt.name AND company_id = $1) 
             ELSE false 
           END as has_company_specific_version
         FROM leave_policies lp
         JOIN leave_types lt ON lp.leave_type_id = lt.id
         WHERE lt.company_id IS NULL OR lt.company_id = $1
         ORDER BY lt.name, is_global_policy DESC`,
        [companyId]
      );

      // Process results to keep only one version of each policy
      // Priority: company-specific > global
      const policyMap = new Map();
      const finalPolicies = [];

      // First pass: collect all policies by name
      for (const policy of result.rows) {
        const policyKey = policy.leave_type_name;

        if (!policyMap.has(policyKey)) {
          policyMap.set(policyKey, []);
        }

        policyMap.get(policyKey).push(policy);
      }

      // Second pass: prioritize company-specific policies over global ones
      for (const [_, policies] of policyMap) {
        // Sort policies: company-specific first, then global
        policies.sort((a: any, b: any) => {
          if (a.is_global_policy && !b.is_global_policy) return 1;
          if (!a.is_global_policy && b.is_global_policy) return -1;
          return 0;
        });

        // Add the first (highest priority) policy to the final list
        finalPolicies.push(policies[0]);

        // If we have a company-specific policy and show_all is set, also include the global one
        if (req.query.show_all === "true" && policies.length > 1) {
          finalPolicies.push(...policies.slice(1));
        }
      }

      res.json(finalPolicies);
    } catch (error) {
      console.error("Error fetching leave policies:", error);
      res.status(500).json({ error: "Failed to fetch leave policies" });
    }
  }
);

// Create new leave policy
router.post(
  "/leave-policies",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
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
        rules,
      } = req.body;

      // Validate gender_specific value
      if (gender_specific && !["male", "female"].includes(gender_specific)) {
        return res.status(400).json({
          error: "Invalid Value",
          details:
            'Gender specific value must be either "male", "female", or null',
        });
      }

      // Start a transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Get the leave type to ensure default_days doesn't exceed max_days
        const leaveTypeResult = await client.query(
          `SELECT max_days FROM leave_types WHERE id = $1`,
          [leave_type_id]
        );
        
        if (leaveTypeResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Leave type not found" });
        }
        
        const { max_days } = leaveTypeResult.rows[0];
        
        // Note: default_days is the actual allocation days for users
        // It should not exceed the max_days constraint from the leave type
        const finalDefaultDays = Math.min(default_days, max_days);

        // Insert the policy
        const policyResult = await client.query(
          `INSERT INTO leave_policies 
         (leave_type_id, default_days, carry_forward_days, min_service_days,
          requires_approval, notice_period_days, max_consecutive_days,
          gender_specific, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
          [
            leave_type_id,
            finalDefaultDays,
            carry_forward_days,
            min_service_days,
            requires_approval,
            notice_period_days,
            max_consecutive_days,
            gender_specific,
            is_active,
          ]
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

        await client.query("COMMIT");
        res.status(201).json(policyResult.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error creating leave policy:", error);
      res.status(500).json({ error: "Failed to create leave policy" });
    }
  }
);

// Update leave policy
router.put(
  "/leave-policies/:id",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
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
        rules,
      } = req.body;

      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get the company_id of the requesting user
      const userResult = await pool.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      const companyId = userResult.rows[0]?.company_id;

      if (!companyId) {
        return res
          .status(400)
          .json({ error: "User not associated with any company" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // First check if this policy exists
        const policyResult = await client.query(
          `SELECT lp.*, lt.id as leave_type_id, lt.max_days, lt.name as leave_type_name, lt.company_id, 
             (SELECT COUNT(*) FROM leave_types WHERE id = lt.id AND company_id IS NULL) > 0 as is_global_type
           FROM leave_policies lp
           JOIN leave_types lt ON lp.leave_type_id = lt.id
           WHERE lp.id = $1`,
          [id]
        );

        if (policyResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Leave policy not found" });
        }

        const policy = policyResult.rows[0];
        const leaveTypeId = policy.leave_type_id;
        const maxDays = policy.max_days;
        
        // Ensure default_days doesn't exceed max_days constraint
        const finalDefaultDays = Math.min(default_days, maxDays);

        // If the policy belongs to a global leave type, we'll create a company-specific copy
        if (policy.is_global_type) {
          // First, we need to create a company-specific copy of the leave type if it doesn't exist
          const existingTypeResult = await client.query(
            `SELECT * FROM leave_types 
             WHERE name = $1 AND company_id = $2`,
            [policy.leave_type_name, companyId]
          );

          let companyLeaveTypeId;

          if (existingTypeResult.rows.length > 0) {
            // Company already has a leave type with this name
            companyLeaveTypeId = existingTypeResult.rows[0].id;
          } else {
            // Create a company-specific copy of the leave type
            const globalTypeResult = await client.query(
              `SELECT * FROM leave_types WHERE id = $1`,
              [policy.leave_type_id]
            );

            if (globalTypeResult.rows.length === 0) {
              await client.query("ROLLBACK");
              return res.status(404).json({ error: "Leave type not found" });
            }

            const globalType = globalTypeResult.rows[0];

            const newTypeResult = await client.query(
              `INSERT INTO leave_types 
               (name, description, requires_documentation, max_days, is_paid, is_active, company_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                globalType.name,
                globalType.description,
                globalType.requires_documentation,
                globalType.max_days,
                globalType.is_paid,
                globalType.is_active,
                companyId,
              ]
            );

            companyLeaveTypeId = newTypeResult.rows[0].id;
          }

          // Now create/update the policy for the company-specific leave type
          const companyPolicyResult = await client.query(
            `INSERT INTO leave_policies 
             (leave_type_id, default_days, carry_forward_days, min_service_days,
              requires_approval, notice_period_days, max_consecutive_days,
              gender_specific, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (leave_type_id) DO UPDATE 
             SET default_days = EXCLUDED.default_days,
                 carry_forward_days = EXCLUDED.carry_forward_days,
                 min_service_days = EXCLUDED.min_service_days,
                 requires_approval = EXCLUDED.requires_approval,
                 notice_period_days = EXCLUDED.notice_period_days,
                 max_consecutive_days = EXCLUDED.max_consecutive_days,
                 gender_specific = EXCLUDED.gender_specific,
                 is_active = EXCLUDED.is_active
             RETURNING *`,
            [
              companyLeaveTypeId,
              finalDefaultDays,
              carry_forward_days,
              min_service_days,
              requires_approval,
              notice_period_days,
              max_consecutive_days,
              gender_specific,
              is_active,
            ]
          );

          // Update rules if provided
          if (rules) {
            // Delete existing rules
            await client.query(
              "DELETE FROM leave_policy_rules WHERE policy_id = $1",
              [companyPolicyResult.rows[0].id]
            );

            // Insert new rules
            for (const rule of rules) {
              await client.query(
                `INSERT INTO leave_policy_rules 
                 (policy_id, rule_type, rule_value)
                 VALUES ($1, $2, $3)`,
                [companyPolicyResult.rows[0].id, rule.type, rule.value]
              );
            }
          }

          await client.query("COMMIT");
          return res.json({
            ...companyPolicyResult.rows[0],
            message: "Created company-specific copy of global leave policy",
          });
        }

        // For company-specific policies, verify the policy's leave type belongs to this company
        if (policy.company_id !== companyId) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error: "You don't have permission to modify this policy",
            details: "The policy belongs to a leave type from another company",
          });
        }

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
          [
            finalDefaultDays,
            carry_forward_days,
            min_service_days,
            requires_approval,
            notice_period_days,
            max_consecutive_days,
            gender_specific,
            is_active,
            id,
          ]
        );

        if (result.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Leave policy not found" });
        }

        // Update rules if provided
        if (rules) {
          // Delete existing rules
          await client.query(
            "DELETE FROM leave_policy_rules WHERE policy_id = $1",
            [id]
          );

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

        await client.query("COMMIT");
        res.json(result.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error updating leave policy:", error);
      res.status(500).json({ error: "Failed to update leave policy" });
    }
  }
);

// Get leave analytics
router.get(
  "/analytics",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    try {
      // Default to last 30 days if no dates provided
      const defaultStartDate = new Date();
      defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);

      let startDate = req.query.start_date
        ? new Date(req.query.start_date as string)
        : defaultStartDate;
      let endDate = req.query.end_date
        ? new Date(req.query.end_date as string)
        : new Date();

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: "Invalid date format",
          details: "Please provide dates in YYYY-MM-DD format",
        });
      }

      // Ensure we have the user ID
      if (!req.user?.id) {
        return res.status(401).json({
          error: "Authentication required",
          details: "User ID not found",
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
            rejected_requests: 0,
          },
          typeDistribution: [],
          trend: [],
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
          total_requests: parseInt(statsResult.rows[0]?.total_requests || "0"),
          approved_requests: parseInt(
            statsResult.rows[0]?.approved_requests || "0"
          ),
          pending_requests: parseInt(
            statsResult.rows[0]?.pending_requests || "0"
          ),
          rejected_requests: parseInt(
            statsResult.rows[0]?.rejected_requests || "0"
          ),
        },
        typeDistribution: typeDistribution.rows || [],
        trend: trend.rows || [],
      };

      console.log("Analytics Response:", JSON.stringify(response, null, 2)); // Debug log
      res.json(response);
    } catch (error) {
      console.error("Error in analytics:", error);
      res.status(500).json({
        error: "Failed to fetch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Calculate and initialize leave balances for a user
export const calculateLeaveBalances = async (userId: number, year: number) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get all active leave types and their policies
    const leaveTypesResult = await client.query(`
      SELECT 
        lt.id, 
        lt.max_days,
        COALESCE(lp.default_days, lt.max_days) as default_days, 
        COALESCE(lp.carry_forward_days, 0) as carry_forward_days
      FROM leave_types lt
      LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
      WHERE lt.is_active = true
    `);

    // Get previous year's balances for carry forward calculation
    const prevYearBalances = await client.query(
      `
      SELECT leave_type_id, (total_days - used_days - pending_days) as available_days
      FROM leave_balances
      WHERE user_id = $1 AND year = $2
    `,
      [userId, year - 1]
    );

    const prevBalancesMap = prevYearBalances.rows.reduce((acc, row) => {
      acc[row.leave_type_id] = parseInt(row.available_days) || 0;
      return acc;
    }, {});

    // Calculate and upsert balances for each leave type
    for (const leaveType of leaveTypesResult.rows) {
      // Calculate carry forward days - limited by policy maximum
      const carryForwardDays = Math.min(
        prevBalancesMap[leaveType.id] || 0,
        parseInt(leaveType.carry_forward_days) || 0
      );

      // Use default_days from policy, falling back to max_days from leave types if needed
      const defaultDays = parseInt(leaveType.default_days) || 0;
      const totalDays = defaultDays + carryForwardDays;

      await client.query(
        `
        INSERT INTO leave_balances (
          user_id, leave_type_id, total_days, used_days, pending_days, carry_forward_days, year
        )
        VALUES ($1, $2, $3, 0, 0, $4, $5)
        ON CONFLICT (user_id, leave_type_id, year)
        DO UPDATE SET
          total_days = $3,
          carry_forward_days = $4,
          updated_at = CURRENT_TIMESTAMP
      `,
        [userId, leaveType.id, totalDays, carryForwardDays, year]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
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
router.get(
  "/users",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const users = await getUsersUnderManagement(Number(userId));
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);

// Update leave balance endpoint to check user access
router.get(
  "/leave-balances/:userId",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const managementId = req.user?.id;
      const year =
        parseInt(req.query.year as string) || new Date().getFullYear();

      if (!managementId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if the requested user is under this management's hierarchy
      const allowedUsers = await getUsersUnderManagement(Number(managementId));
      const isAllowed = allowedUsers.some((user) => user.id === userId);

      if (!isAllowed) {
        return res
          .status(403)
          .json({ error: "Access denied to this user's leave balances" });
      }

      // Calculate balances if they don't exist
      await calculateLeaveBalances(userId, year);

      // Get the calculated balances
      const result = await pool.query(
        `
      SELECT 
        lb.*,
        lt.name as leave_type_name,
        lt.description as leave_type_description,
        lt.is_paid
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = $1 AND lb.year = $2
      ORDER BY lt.name
    `,
        [userId, year]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching leave balances:", error);
      res.status(500).json({ error: "Failed to fetch leave balances" });
    }
  }
);

// Update leave balance when a leave request is processed
const updateLeaveBalance = async (
  userId: number,
  leaveTypeId: number,
  days: number,
  status: "pending" | "approved" | "rejected",
  year: number
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (status === "pending") {
      await client.query(
        `
        UPDATE leave_balances
        SET pending_days = pending_days + $1
        WHERE user_id = $2 AND leave_type_id = $3 AND year = $4
      `,
        [days, userId, leaveTypeId, year]
      );
    } else if (status === "approved") {
      await client.query(
        `
        UPDATE leave_balances
        SET used_days = used_days + $1,
            pending_days = pending_days - $1
        WHERE user_id = $2 AND leave_type_id = $3 AND year = $4
      `,
        [days, userId, leaveTypeId, year]
      );
    } else if (status === "rejected") {
      await client.query(
        `
        UPDATE leave_balances
        SET pending_days = pending_days - $1
        WHERE user_id = $2 AND leave_type_id = $3 AND year = $4
      `,
        [days, userId, leaveTypeId, year]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// Process year-end leave balance calculations
router.post(
  "/process-year-end",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;

      // Get all users
      const usersResult = await client.query(
        "SELECT id FROM users WHERE role != 'super-admin'"
      );

      for (const user of usersResult.rows) {
        await calculateLeaveBalances(user.id, nextYear);
      }

      await client.query("COMMIT");
      res.json({ message: "Year-end leave balances processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error processing year-end balances:", error);
      res.status(500).json({ error: "Failed to process year-end balances" });
    } finally {
      client.release();
    }
  }
);

// Get documents for a leave request
router.get(
  "/leave-requests/:id/documents",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id } = req.params;

      // Check if user has access to this leave request
      const accessCheck = await client.query(
        `
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
        return res.status(403).json({ error: "Access denied" });
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
      console.error("Error fetching leave request documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    } finally {
      client.release();
    }
  }
);

// Update the leave request submission route to handle documents
router.post(
  "/leave-requests",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const {
        leave_type_id,
        start_date,
        end_date,
        reason,
        contact_number,
        documents,
      } = req.body;

      // Validate required fields
      if (
        !leave_type_id ||
        !start_date ||
        !end_date ||
        !reason ||
        !contact_number
      ) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Get leave type details and notice period policy
      const leaveTypeResult = await client.query(
        `
      SELECT lt.*, lp.notice_period_days
      FROM leave_types lt
      JOIN leave_policies lp ON lt.id = lp.leave_type_id
      WHERE lt.id = $1
    `,
        [leave_type_id]
      );

      if (!leaveTypeResult.rows.length) {
        return res.status(400).json({ error: "Invalid leave type" });
      }

      const leaveType = leaveTypeResult.rows[0];

      // Validate dates
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate < today) {
        return res
          .status(400)
          .json({ error: "Start date cannot be in the past" });
      }

      if (endDate < startDate) {
        return res
          .status(400)
          .json({ error: "End date must be after start date" });
      }

      // Check notice period
      const noticeDays = Math.ceil(
        (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (noticeDays < leaveType.notice_period_days) {
        const earliestPossibleDate = new Date();
        earliestPossibleDate.setDate(
          earliestPossibleDate.getDate() + leaveType.notice_period_days
        );
        return res.status(400).json({
          error: "Notice period requirement not met",
          details: {
            required_days: leaveType.notice_period_days,
            earliest_possible_date: earliestPossibleDate
              .toISOString()
              .split("T")[0],
            message: `This leave type requires ${
              leaveType.notice_period_days
            } days notice. The earliest date you can apply for is ${
              earliestPossibleDate.toISOString().split("T")[0]
            }.`,
          },
        });
      }

      // Calculate days requested
      const days_requested =
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

      // Get user's current leave balance
      const balanceResult = await client.query(
        `SELECT * FROM leave_balances 
       WHERE user_id = $1 AND leave_type_id = $2 AND year = $3`,
        [req.user.id, leave_type_id, new Date().getFullYear()]
      );

      if (balanceResult.rows.length === 0) {
        throw new Error("No leave balance found");
      }

      const balance = balanceResult.rows[0];
      const availableDays =
        balance.total_days - balance.used_days - balance.pending_days;

      if (days_requested > availableDays) {
        throw new Error("Insufficient leave balance");
      }

      // Check gender-specific leave types
      if (leaveType.gender_specific) {
        const userResult = await client.query(
          "SELECT gender FROM users WHERE id = $1",
          [req.user.id]
        );

        if (!userResult.rows[0]?.gender) {
          return res.status(400).json({
            error: "Missing Information",
            details:
              "User gender information is required for this type of leave",
          });
        }

        if (userResult.rows[0].gender !== leaveType.gender_specific) {
          return res.status(400).json({
            error: "Not Eligible",
            details: `This leave type is only available for ${leaveType.gender_specific} employees`,
          });
        }
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
          req.user.id,
          leave_type_id,
          start_date,
          end_date,
          reason,
          contact_number,
          leaveType.requires_documentation,
          documents && documents.length > 0,
          "pending",
          days_requested,
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
            [
              requestId,
              doc.file_name,
              doc.file_type,
              doc.file_data,
              doc.upload_method,
            ]
          );
        }
      }

      // Update leave balance
      await updateLeaveBalance(
        Number(req.user.id),
        leave_type_id,
        days_requested,
        "pending",
        new Date().getFullYear()
      );

      await client.query("COMMIT");
      res.status(201).json({
        message: "Leave request submitted successfully",
        request_id: requestId,
      });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Error processing leave request:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to process leave request" });
    } finally {
      client.release();
    }
  }
);

// Process leave request approval/rejection
router.post(
  "/leave-requests/:id/:action",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id, action } = req.params;
      const { rejection_reason, resolution_notes } = req.body;

      await client.query("BEGIN");

      const requestResult = await client.query(
        `
      SELECT 
        lr.*, 
        le.id as escalation_id, 
        le.status as escalation_status 
      FROM leave_requests lr 
      LEFT JOIN leave_escalations le ON lr.id = le.request_id 
      WHERE lr.id = $1
    `,
        [id]
      );

      if (!requestResult.rows.length) {
        throw new Error("Leave request not found");
      }

      const request = requestResult.rows[0];
      const isEscalated = request.status === "escalated";
      const now = new Date();

      if (isEscalated) {
        if (!resolution_notes) {
          throw new Error(
            "Resolution notes are required for escalated requests"
          );
        }

        await client.query(
          "UPDATE leave_escalations SET status = $1, resolution_notes = $2, resolved_at = $3 WHERE request_id = $4",
          ["resolved", resolution_notes, now, id]
        );
      }

      if (action === "approve" || action === "reject") {
        await client.query(
          "UPDATE leave_requests SET status = $1, rejection_reason = $2, updated_at = $3 WHERE id = $4",
          [
            action === "approve" ? "approved" : "rejected",
            action === "reject" ? rejection_reason : null,
            now,
            id,
          ]
        );

        // Update leave balance
        if (action === "approve") {
          await client.query(
            `
          UPDATE leave_balances
          SET 
            used_days = used_days + $1,
            pending_days = pending_days - $1,
            updated_at = NOW()
          WHERE user_id = $2 AND leave_type_id = $3 AND year = EXTRACT(YEAR FROM NOW())
        `,
            [request.days_requested, request.user_id, request.leave_type_id]
          );
        } else if (action === "reject") {
          // When rejecting, just decrease pending_days
          await client.query(
            `
          UPDATE leave_balances
          SET 
            pending_days = pending_days - $1,
            updated_at = NOW()
          WHERE user_id = $2 AND leave_type_id = $3 AND year = EXTRACT(YEAR FROM NOW())
        `,
            [request.days_requested, request.user_id, request.leave_type_id]
          );
        }
      }

      await client.query("COMMIT");
      res.json({ message: "Leave request processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error processing request:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      client.release();
    }
  }
);

// Get escalated leave requests
router.get(
  "/escalated-requests",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
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
      console.error("Error fetching escalated requests:", error);
      res.status(500).json({ error: "Failed to fetch escalated requests" });
    }
  }
);

// Get all leave requests for management
router.get(
  "/leave-requests",
  authMiddleware,
  managementMiddleware,
  async (req: CustomRequest, res: Response) => {
    try {
      const userId = req.query.user_id
        ? parseInt(req.query.user_id as string)
        : req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
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
      console.error("Error fetching leave requests:", error);
      res.status(500).json({ error: "Failed to fetch leave requests" });
    }
  }
);

// Get pending leave requests for management
router.get(
  "/pending-requests",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await client.query(
        `
      WITH management_company AS (
        SELECT company_id FROM users WHERE id = $1
      )
      SELECT 
        lr.id,
        lr.user_id,
        u.name as user_name,
        u.employee_number,
        u.department,
        lr.leave_type_id,
        lt.name as leave_type_name,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason,
        lr.status,
        lr.contact_number,
        lr.requires_documentation,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', ld.id,
            'file_name', ld.file_name,
            'file_type', ld.file_type
          ))
          FROM leave_documents ld
          WHERE ld.request_id = lr.id
          ), '[]'
        ) as documents,
        CASE 
          WHEN le.id IS NOT NULL THEN json_build_object(
            'escalation_id', le.id,
            'escalated_by', le.escalated_by,
            'escalated_by_name', eu.name,
            'reason', le.reason,
            'escalated_at', le.created_at,
            'status', le.status,
            'resolution_notes', le.resolution_notes
          )
          ELSE NULL
        END as escalation_details
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN leave_escalations le ON lr.id = le.request_id
      LEFT JOIN users eu ON le.escalated_by = eu.id
      WHERE (
        (lr.user_id = $1 AND lr.status = 'pending') -- Management's own pending requests
        OR (
          u.role = 'group-admin' 
          AND u.company_id = (SELECT company_id FROM management_company)
          AND lr.status = 'pending'
        ) -- Direct pending requests from group admins
        OR (
          lr.status = 'escalated'
          AND le.escalated_to = $1
          AND le.status = 'pending'
        ) -- Escalated requests assigned to this manager
      )
      ORDER BY 
        CASE 
          WHEN lr.status = 'escalated' THEN 0
          WHEN lr.user_id = $1 THEN 1
          ELSE 2
        END,
        lr.created_at DESC
    `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ error: "Failed to fetch requests" });
    } finally {
      client.release();
    }
  }
);

// Update the stats endpoint
router.get(
  "/stats",
  authMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      // Get the management user's information
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user info including role and company_id
      const userResult = await client.query(
        `SELECT id, role, company_id FROM users WHERE id = $1`,
        [req.user.id]
      );

      const userData = userResult.rows[0];

      if (!userData || !userData.company_id) {
        return res
          .status(400)
          .json({ error: "User not associated with any company" });
      }

      const companyId = userData.company_id;
      const managementId = userData.id;
      const isManagement = userData.role === "management";

      // Get user IDs under this management's supervision
      let userIdsQuery;
      let userIdsParams;

      if (isManagement) {
        // For management users, get all users in the same company with roles 'employee' or 'group-admin'
        userIdsQuery = `
        SELECT array_agg(id) as user_ids
        FROM users
        WHERE company_id = $1
        AND (role = 'employee' OR role = 'group-admin')
      `;
        userIdsParams = [companyId];
      } else {
        // For other users (like group-admin), get only their direct employees
        userIdsQuery = `
        SELECT array_agg(id) as user_ids
        FROM users
        WHERE group_admin_id = $1
        AND role = 'employee'
      `;
        userIdsParams = [managementId];
      }

      const userIdsResult = await client.query(userIdsQuery, userIdsParams);
      const userIds = userIdsResult.rows[0]?.user_ids || [];

      if (userIds.length === 0) {
        // No users under management, return zeros
        return res.json({
          pending_requests: 0,
          approved_requests: 0,
          active_leave_types: 0,
        });
      }

      // Get pending and approved requests count for the users under management
      const requestsResult = await client.query(
        `SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests
      FROM leave_requests
      WHERE user_id = ANY($1)
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
        [userIds]
      );

      // Get active leave types count for the company
      const leaveTypesResult = await client.query(
        `SELECT COUNT(*) as active_leave_types
      FROM leave_types
      WHERE is_active = true
      AND (company_id IS NULL OR company_id = $1)`,
        [companyId]
      );

      const stats = {
        pending_requests: parseInt(
          requestsResult.rows[0]?.pending_requests || "0"
        ),
        approved_requests: parseInt(
          requestsResult.rows[0]?.approved_requests || "0"
        ),
        active_leave_types: parseInt(
          leaveTypesResult.rows[0]?.active_leave_types || "0"
        ),
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching leave stats:", error);
      res.status(500).json({
        error: "Failed to fetch leave stats",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      client.release();
    }
  }
);

// Add document retrieval endpoint
router.get('/document/:id', [authMiddleware, managementMiddleware], async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Check if the user has access to this document
    const result = await client.query(`
      SELECT ld.file_data, ld.file_type 
      FROM leave_documents ld
      JOIN leave_requests lr ON ld.request_id = lr.id
      JOIN users u ON lr.user_id = u.id
      WHERE ld.id = $1
      AND (
        lr.user_id = $2
        OR (u.group_admin_id = $2 AND $3 = 'group-admin')
        OR $3 = 'management'
      )`,
      [id, req.user.id, req.user.role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    const document = result.rows[0];
    
    // Send base64 data directly
    res.setHeader('Content-Type', 'text/plain');
    res.send(document.file_data);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  } finally {
    client.release();
  }
});

export default router; 