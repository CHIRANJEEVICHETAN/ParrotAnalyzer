-- Group Admin Shifts Table
CREATE TABLE group_admin_shifts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration INTERVAL,
    status VARCHAR(20) DEFAULT 'active',
    total_kilometers NUMERIC DEFAULT 0,
    total_expenses NUMERIC DEFAULT 0,
    location_start POINT,
    location_end POINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_group_admin_shifts_start_time ON group_admin_shifts(start_time);
CREATE INDEX idx_group_admin_shifts_status ON group_admin_shifts(status);


-- Management Shifts Table
CREATE TABLE management_shifts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration INTERVAL,
    status VARCHAR(20) DEFAULT 'active',
    total_kilometers NUMERIC DEFAULT 0,
    total_expenses NUMERIC DEFAULT 0,
    location_start POINT,
    location_end POINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_management_shifts_start_time ON management_shifts(start_time);
CREATE INDEX idx_management_shifts_status ON management_shifts(status);
