-- Create company tracking settings table
CREATE TABLE IF NOT EXISTS company_tracking_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    default_tracking_precision VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (default_tracking_precision IN ('low', 'medium', 'high')),
    update_interval_seconds INTEGER NOT NULL DEFAULT 30,
    battery_saving_enabled BOOLEAN NOT NULL DEFAULT true,
    indoor_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id)
);

-- Create update timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for company tracking settings
CREATE TRIGGER update_settings_timestamp
BEFORE UPDATE ON company_tracking_settings
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Create user tracking permissions table
CREATE TABLE IF NOT EXISTS user_tracking_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_override_geofence BOOLEAN NOT NULL DEFAULT false,
    tracking_precision VARCHAR(20) NOT NULL DEFAULT 'high' CHECK (tracking_precision IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_tracking_permission UNIQUE (user_id)
);

-- Create index on user tracking permissions
CREATE INDEX IF NOT EXISTS idx_user_tracking_permissions ON user_tracking_permissions (user_id, tracking_precision);

-- Create trigger for user tracking permissions
CREATE TRIGGER update_permissions_timestamp
BEFORE UPDATE ON user_tracking_permissions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp(); 