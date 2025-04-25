-- Create tracking_analytics table for user activity analytics
CREATE TABLE IF NOT EXISTS tracking_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_distance NUMERIC(10,2) DEFAULT 0,
    total_distance_km NUMERIC(10,2) DEFAULT 0,
    total_travel_time_minutes INTEGER DEFAULT 0,
    outdoor_time INTEGER DEFAULT 0,
    indoor_time INTEGER DEFAULT 0,
    indoor_time_minutes INTEGER DEFAULT 0,
    outdoor_time_minutes INTEGER DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on user_id and date to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_analytics_user_date ON tracking_analytics(user_id, date);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tracking_analytics_date ON tracking_analytics(date);
CREATE INDEX IF NOT EXISTS idx_tracking_analytics_user ON tracking_analytics(user_id); 