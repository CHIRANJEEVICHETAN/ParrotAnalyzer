-- Add shift timer settings table
CREATE TABLE IF NOT EXISTS shift_timer_settings (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    timer_duration_hours NUMERIC(5, 2) NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    notification_sent BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES employee_shifts(id) ON DELETE CASCADE
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_shift_timer_pending ON shift_timer_settings (completed, end_time);
CREATE INDEX IF NOT EXISTS idx_shift_timer_notification ON shift_timer_settings (notification_sent, end_time);
CREATE INDEX IF NOT EXISTS idx_shift_timer_user_id ON shift_timer_settings (user_id);