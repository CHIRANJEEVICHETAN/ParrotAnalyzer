-- 20240610_leave_management_revamp.sql
-- Migration for Leave Management System Revamp

-- 0. Add unique constraint for leave types
ALTER TABLE leave_types ADD CONSTRAINT unique_leave_type_name_company UNIQUE (name, company_id);

-- 1. Remove global leave types (company_id IS NULL)
--    (But first, clone them for companies that use them)

-- 2. Add new table: company_default_leave_balances
CREATE TABLE IF NOT EXISTS company_default_leave_balances (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL CHECK (role IN ('management', 'group_admin', 'employee')),
    default_days INTEGER NOT NULL,
    carry_forward_days INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, leave_type_id, role)
);

-- 3. Add new table: manual_leave_adjustments
CREATE TABLE IF NOT EXISTS manual_leave_adjustments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    adjusted_by INTEGER NOT NULL REFERENCES users(id),
    before_value INTEGER NOT NULL,
    after_value INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Update leave_types: enforce company_id NOT NULL, remove global types
ALTER TABLE leave_types ALTER COLUMN company_id SET NOT NULL;

-- 5. Remove global leave types and policies (company_id IS NULL)
--    (But first, clone for companies that use them)
--    (This step may require a script, but here is a SQL approach for reference)

-- For each company, clone global leave_types and leave_policies
-- (This is a simplified version; a script may be needed for full data integrity)

-- 6. Update leave_balances: ensure all are company-scoped
-- (No schema change needed if leave_type_id is always company-specific)

-- 7. Remove triggers or defaults that auto-create leave types/policies/balances on company creation
-- (Handled in application logic)

-- 8. Add audit columns if needed (already present in new tables)

-- 9. Disable global leave_types and leave_policies (set is_active = false)
UPDATE leave_types SET is_active = false WHERE company_id IS NULL;
UPDATE leave_policies SET is_active = false WHERE leave_type_id IN (SELECT id FROM leave_types WHERE company_id IS NULL);

-- 10. (Optional) Add index for manual_leave_adjustments
CREATE INDEX IF NOT EXISTS idx_manual_leave_adjustments_user_year ON manual_leave_adjustments(user_id, year);

-- 11. (Optional) Add index for company_default_leave_balances
CREATE INDEX IF NOT EXISTS idx_company_default_leave_balances_company ON company_default_leave_balances(company_id);

-- 12. (Optional) Add migration log
-- INSERT INTO migration_log (migration, applied_at) VALUES ('20240610_leave_management_revamp.sql', NOW()); 

-- Add approval_levels table
CREATE TABLE IF NOT EXISTS approval_levels (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    level_name VARCHAR(50) NOT NULL,
    level_order INTEGER NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, level_order)
);

-- Add approval_workflows table
CREATE TABLE IF NOT EXISTS approval_workflows (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
    min_days INTEGER NOT NULL DEFAULT 1,
    max_days INTEGER,
    requires_all_levels BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, leave_type_id, min_days)
);

-- Add workflow_levels table to map workflows to approval levels
CREATE TABLE IF NOT EXISTS workflow_levels (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES approval_workflows(id),
    level_id INTEGER NOT NULL REFERENCES approval_levels(id),
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workflow_id, level_id)
);

-- Add request_approvals table to track approvals for each request
CREATE TABLE IF NOT EXISTS request_approvals (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES leave_requests(id),
    workflow_id INTEGER NOT NULL REFERENCES approval_workflows(id),
    level_id INTEGER NOT NULL REFERENCES approval_levels(id),
    approver_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (request_id, level_id, approver_id)
);

-- Add columns to leave_requests table
ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS workflow_id INTEGER REFERENCES approval_workflows(id),
ADD COLUMN IF NOT EXISTS current_level_id INTEGER REFERENCES approval_levels(id),
ADD COLUMN IF NOT EXISTS final_approver_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_approval_levels_company ON approval_levels(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_company ON approval_workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_levels_workflow ON workflow_levels(workflow_id);
CREATE INDEX IF NOT EXISTS idx_request_approvals_request ON request_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_request_approvals_workflow ON request_approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_request_approvals_level ON request_approvals(level_id);
CREATE INDEX IF NOT EXISTS idx_request_approvals_approver ON request_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_workflow ON leave_requests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_current_level ON leave_requests(current_level_id);

-- Add default approval levels for existing companies
INSERT INTO approval_levels (company_id, level_name, level_order, role)
SELECT 
    c.id as company_id,
    'Group Admin' as level_name,
    1 as level_order,
    'group_admin' as role
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM approval_levels al 
    WHERE al.company_id = c.id AND al.level_order = 1
)
UNION ALL
SELECT 
    c.id as company_id,
    'Management' as level_name,
    2 as level_order,
    'management' as role
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM approval_levels al 
    WHERE al.company_id = c.id AND al.level_order = 2
);

-- Add default approval workflows for existing leave types
INSERT INTO approval_workflows (company_id, leave_type_id, min_days, max_days, requires_all_levels)
SELECT 
    lt.company_id,
    lt.id as leave_type_id,
    1 as min_days,
    CASE 
        WHEN lt.name LIKE '%Maternity%' THEN 90
        WHEN lt.name LIKE '%Paternity%' THEN 10
        WHEN lt.name LIKE '%Marriage%' THEN 5
        WHEN lt.name LIKE '%Bereavement%' THEN 5
        WHEN lt.name LIKE '%Sick%' THEN 3
        ELSE NULL
    END as max_days,
    CASE 
        WHEN lt.name IN ('Maternity Leave (ML)', 'Paternity Leave', 'Sabbatical Leave') THEN true
        ELSE false
    END as requires_all_levels
FROM leave_types lt
WHERE lt.company_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM approval_workflows aw 
    WHERE aw.company_id = lt.company_id 
    AND aw.leave_type_id = lt.id
);

-- Map workflows to levels
INSERT INTO workflow_levels (workflow_id, level_id, is_required)
SELECT 
    aw.id as workflow_id,
    al.id as level_id,
    CASE 
        WHEN aw.requires_all_levels THEN true
        WHEN al.level_order = 1 THEN true
        ELSE false
    END as is_required
FROM approval_workflows aw
CROSS JOIN approval_levels al
WHERE aw.company_id = al.company_id
AND NOT EXISTS (
    SELECT 1 FROM workflow_levels wl 
    WHERE wl.workflow_id = aw.id 
    AND wl.level_id = al.id
);

-- Update existing leave requests to use new workflow
WITH workflow_mapping AS (
    SELECT 
        lr.id as request_id,
        aw.id as workflow_id,
        al.id as level_id
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    JOIN approval_workflows aw ON aw.leave_type_id = lt.id
    JOIN approval_levels al ON al.company_id = lt.company_id
    WHERE lr.workflow_id IS NULL
    AND al.level_order = 1
)
UPDATE leave_requests lr
SET 
    workflow_id = wm.workflow_id,
    current_level_id = wm.level_id,
    approval_status = CASE 
        WHEN lr.status = 'approved' THEN 'approved'
        WHEN lr.status = 'rejected' THEN 'rejected'
        ELSE 'pending'
    END
FROM workflow_mapping wm
WHERE lr.id = wm.request_id; 