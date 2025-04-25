-- Create indexes for error_logs table to optimize query performance

-- Index for timestamp-based queries (used in cleanup and time range queries)
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs (timestamp DESC);

-- Composite index for user_id and timestamp (used in getUserErrors)
CREATE INDEX IF NOT EXISTS idx_error_logs_user_timestamp ON error_logs (user_id, timestamp DESC);

-- Composite index for service and timestamp (used in getServiceErrors)
CREATE INDEX IF NOT EXISTS idx_error_logs_service_timestamp ON error_logs (service, timestamp DESC);

-- Index for error_type (used in error frequency analysis)
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs (error_type);

-- Create a function to clean up old error logs
CREATE OR REPLACE FUNCTION cleanup_old_error_logs(retention_days integer)
RETURNS void AS $$
BEGIN
    DELETE FROM error_logs 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get error frequency by type
CREATE OR REPLACE FUNCTION get_error_frequency(
    start_date timestamp,
    end_date timestamp
)
RETURNS TABLE (
    error_type text,
    frequency bigint,
    first_occurrence timestamp,
    last_occurrence timestamp
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.error_type,
        COUNT(*) as frequency,
        MIN(e.timestamp) as first_occurrence,
        MAX(e.timestamp) as last_occurrence
    FROM error_logs e
    WHERE e.timestamp BETWEEN start_date AND end_date
    GROUP BY e.error_type
    ORDER BY frequency DESC;
END;
$$ LANGUAGE plpgsql; 