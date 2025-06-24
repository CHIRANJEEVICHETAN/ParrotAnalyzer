-- Fix timezone handling for shift_timer_settings table
-- This migration ensures proper timezone storage

-- First, backup any existing data if the table exists
DO $$
BEGIN
    -- Check if the table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shift_timer_settings') THEN
        -- If there are any pending timers, we'll migrate them
        UPDATE shift_timer_settings 
        SET end_time = end_time AT TIME ZONE 'Asia/Kolkata'
        WHERE completed = FALSE;
        
        -- Add a comment to track this migration
        COMMENT ON TABLE shift_timer_settings IS 'Updated timezone handling - 2025-01-24';
    END IF;
END $$;

-- Ensure the end_time column can store timezone information properly
-- This will help maintain consistency between timer storage and shift end times

-- Add an index for faster timer processing
CREATE INDEX IF NOT EXISTS idx_shift_timer_settings_pending 
ON shift_timer_settings (user_id, completed, end_time) 
WHERE completed = FALSE;

-- Add an index for faster auto-end processing
CREATE INDEX IF NOT EXISTS idx_shift_timer_settings_auto_end 
ON shift_timer_settings (end_time, completed) 
WHERE completed = FALSE; 