-- Add role_type column to shift_timer_settings table
ALTER TABLE IF EXISTS shift_timer_settings 
ADD COLUMN IF NOT EXISTS role_type VARCHAR(20) DEFAULT 'employee';

-- Add shift_table_name column to shift_timer_settings table to store the table name
ALTER TABLE IF EXISTS shift_timer_settings
ADD COLUMN IF NOT EXISTS shift_table_name VARCHAR(50) DEFAULT 'employee_shifts';

-- Add ended_automatically column to group_admin_shifts table
ALTER TABLE IF EXISTS group_admin_shifts 
ADD COLUMN IF NOT EXISTS ended_automatically BOOLEAN DEFAULT FALSE;

-- Add ended_automatically column to management_shifts table
ALTER TABLE IF EXISTS management_shifts 
ADD COLUMN IF NOT EXISTS ended_automatically BOOLEAN DEFAULT FALSE;

-- Update existing records to have the default role_type
UPDATE shift_timer_settings SET role_type = 'employee' WHERE role_type IS NULL;

-- Update existing records to have the default shift_table_name
UPDATE shift_timer_settings SET shift_table_name = 'employee_shifts' WHERE shift_table_name IS NULL;

-- Add comment to the table
COMMENT ON COLUMN shift_timer_settings.role_type IS 'User role type (employee, group-admin, management) to determine which shift table to use';
COMMENT ON COLUMN shift_timer_settings.shift_table_name IS 'Name of the table where the shift is stored (employee_shifts, group_admin_shifts, management_shifts)'; 

ALTER TABLE IF EXISTS shift_timer_settings
DROP CONSTRAINT IF EXISTS shift_timer_settings_shift_id_fkey;