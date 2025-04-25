-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create employee_locations table
CREATE TABLE IF NOT EXISTS employee_locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    is_moving BOOLEAN DEFAULT false,
    battery_level INTEGER,
    shift_id INTEGER REFERENCES employee_shifts(id) ON DELETE CASCADE,
    is_outdoor BOOLEAN DEFAULT false,
    geofence_status VARCHAR(20),
    movement_type VARCHAR(20),
    location_accuracy INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced indexes for employee_locations
CREATE INDEX idx_employee_locations_user_timestamp ON employee_locations(user_id, timestamp DESC);
CREATE INDEX idx_employee_locations_shift ON employee_locations(shift_id, timestamp DESC);
CREATE INDEX idx_employee_locations_moving ON employee_locations(user_id, is_moving) WHERE is_moving = true;
CREATE INDEX idx_employee_locations_outdoor ON employee_locations(user_id, is_outdoor) WHERE is_outdoor = true;

-- Create company_geofences table with PostGIS
CREATE TABLE IF NOT EXISTS company_geofences (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    coordinates GEOGRAPHY(POLYGON) NOT NULL,
    radius DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Enhanced indexes for geofences
CREATE INDEX idx_company_geofences_coordinates ON company_geofences USING GIST(coordinates);
CREATE INDEX idx_company_geofences_company ON company_geofences(company_id);
CREATE INDEX idx_company_geofences_active ON company_geofences(company_id) WHERE radius > 0;

-- Create user_tracking_permissions table
CREATE TABLE IF NOT EXISTS user_tracking_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    can_override_geofence BOOLEAN DEFAULT false,
    tracking_precision VARCHAR(20) DEFAULT 'high',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick permission lookups
CREATE INDEX idx_user_tracking_permissions ON user_tracking_permissions(user_id, tracking_precision);

-- Create company_tracking_settings table
CREATE TABLE IF NOT EXISTS company_tracking_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    min_location_accuracy INTEGER DEFAULT 50,
    update_interval_seconds INTEGER DEFAULT 30,
    battery_saving_enabled BOOLEAN DEFAULT true,
    indoor_tracking_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for company settings
CREATE UNIQUE INDEX idx_company_tracking_settings ON company_tracking_settings(company_id);

-- Create tracking_analytics table
CREATE TABLE IF NOT EXISTS tracking_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_distance_km DECIMAL(10, 2) DEFAULT 0,
    total_travel_time_minutes INTEGER DEFAULT 0,
    outdoor_time_minutes INTEGER DEFAULT 0,
    indoor_time_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced indexes for analytics
CREATE INDEX idx_tracking_analytics_user_date ON tracking_analytics(user_id, date DESC);
CREATE INDEX idx_tracking_analytics_date ON tracking_analytics(date DESC);

-- Update employee_shifts table with location tracking fields
ALTER TABLE employee_shifts
ADD COLUMN IF NOT EXISTS location_history GEOGRAPHY(LINESTRING),
ADD COLUMN IF NOT EXISTS total_distance_km DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS travel_time_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP;

-- Add spatial index for shift location history
CREATE INDEX idx_employee_shifts_location ON employee_shifts USING GIST(location_history);

-- Add triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_geofences_timestamp
    BEFORE UPDATE ON company_geofences
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_permissions_timestamp
    BEFORE UPDATE ON user_tracking_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_settings_timestamp
    BEFORE UPDATE ON company_tracking_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp(); 