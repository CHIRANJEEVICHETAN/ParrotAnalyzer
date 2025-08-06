-- Migration: Add company_holidays table
-- Date: 2024-06-10
-- Description: Create company_holidays table to store company-specific holidays for calendar functionality

-- Create company_holidays table
CREATE TABLE IF NOT EXISTS company_holidays (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    is_full_day BOOLEAN DEFAULT true,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_holidays_company_id ON company_holidays(company_id);
CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays(date);
CREATE INDEX IF NOT EXISTS idx_company_holidays_active ON company_holidays(is_active);
CREATE INDEX IF NOT EXISTS idx_company_holidays_company_date ON company_holidays(company_id, date);

-- Create unique constraint to prevent duplicate holidays for same company and date
-- This will be used by the ON CONFLICT clause in INSERT statements
ALTER TABLE company_holidays 
ADD CONSTRAINT company_holidays_company_date_unique 
UNIQUE (company_id, date);

-- Add foreign key constraints
ALTER TABLE company_holidays 
ADD CONSTRAINT fk_company_holidays_company_id 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE company_holidays 
ADD CONSTRAINT fk_company_holidays_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE company_holidays 
ADD CONSTRAINT fk_company_holidays_updated_by 
FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- Note: Removed the check constraint for past dates to allow historical holidays
-- This enables better holiday planning and historical reference

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_holidays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_holidays_updated_at
    BEFORE UPDATE ON company_holidays
    FOR EACH ROW
    EXECUTE FUNCTION update_company_holidays_updated_at();

-- Insert some sample holidays for existing companies (optional)
-- You can customize these based on your needs
INSERT INTO company_holidays (company_id, name, date, is_full_day, description, created_by)
SELECT 
    c.id,
    'New Year''s Day',
    DATE '2025-01-01',
    true,
    'New Year''s Day Holiday',
    (SELECT id FROM users WHERE company_id = c.id AND role = 'management' LIMIT 1)
FROM companies c
WHERE c.status = 'active'
ON CONFLICT (company_id, date) DO NOTHING;

INSERT INTO company_holidays (company_id, name, date, is_full_day, description, created_by)
SELECT 
    c.id,
    'Independence Day',
    DATE '2025-08-15',
    true,
    'Independence Day Holiday',
    (SELECT id FROM users WHERE company_id = c.id AND role = 'management' LIMIT 1)
FROM companies c
WHERE c.status = 'active'
ON CONFLICT (company_id, date) DO NOTHING;

INSERT INTO company_holidays (company_id, name, date, is_full_day, description, created_by)
SELECT 
    c.id,
    'Republic Day',
    DATE '2025-01-26',
    true,
    'Republic Day Holiday',
    (SELECT id FROM users WHERE company_id = c.id AND role = 'management' LIMIT 1)
FROM companies c
WHERE c.status = 'active'
ON CONFLICT (company_id, date) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE company_holidays IS 'Stores company-specific holidays for calendar functionality';
COMMENT ON COLUMN company_holidays.id IS 'Primary key for the holiday record';
COMMENT ON COLUMN company_holidays.company_id IS 'Foreign key to companies table';
COMMENT ON COLUMN company_holidays.name IS 'Name of the holiday';
COMMENT ON COLUMN company_holidays.date IS 'Date of the holiday';
COMMENT ON COLUMN company_holidays.is_full_day IS 'Whether this is a full day holiday (true) or partial day (false)';
COMMENT ON COLUMN company_holidays.description IS 'Optional description of the holiday';
COMMENT ON COLUMN company_holidays.is_active IS 'Whether this holiday is currently active';
COMMENT ON COLUMN company_holidays.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN company_holidays.updated_at IS 'Timestamp when the record was last updated';
COMMENT ON COLUMN company_holidays.created_by IS 'User ID who created this holiday record';
COMMENT ON COLUMN company_holidays.updated_by IS 'User ID who last updated this holiday record'; 