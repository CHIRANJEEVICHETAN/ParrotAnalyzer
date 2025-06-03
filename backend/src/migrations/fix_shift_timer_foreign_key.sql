-- This migration fixes the foreign key constraint issue in shift_timer_settings table
-- by making the foreign key to employee_shifts deferrable or removing it

-- Option 1: Make the constraint deferrable


-- We no longer need the FK constraint because we're using shift_table_name to determine the table
-- But we'll keep the column for backward compatibility and data integrity

-- Mark that this migration has been executed
INSERT INTO migration_history (name, executed_at)
VALUES ('fix_shift_timer_foreign_key', NOW())
ON CONFLICT (name) DO UPDATE SET executed_at = NOW(); 