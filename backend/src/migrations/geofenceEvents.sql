-- Create geofence_events table
CREATE TABLE IF NOT EXISTS geofence_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    geofence_id INTEGER NOT NULL REFERENCES company_geofences(id),
    shift_id INTEGER NOT NULL REFERENCES employee_shifts(id),
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('entry', 'exit')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX idx_geofence_events_user_id ON geofence_events(user_id);
CREATE INDEX idx_geofence_events_geofence_id ON geofence_events(geofence_id);
CREATE INDEX idx_geofence_events_shift_id ON geofence_events(shift_id);
CREATE INDEX idx_geofence_events_timestamp ON geofence_events(timestamp);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_geofence_events_updated_at
    BEFORE UPDATE ON geofence_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 