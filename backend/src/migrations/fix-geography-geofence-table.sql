-- Fix script for company_geofences table with geography(Polygon,4326) column
-- This script is specifically for fixing the mismatch between Point data and Polygon column type

-- First back up the table
DO $$
BEGIN
    -- Create backup table if it doesn't exist
    DROP TABLE IF EXISTS company_geofences_backup;
    
    RAISE NOTICE 'Creating backup of company_geofences table...';
    CREATE TABLE company_geofences_backup AS SELECT * FROM company_geofences;
    RAISE NOTICE 'Backup created successfully';
END $$;

-- List existing indexes and constraints to recreate them later
DO $$
DECLARE
    index_names text[];
    constraint_names text[];
BEGIN
    -- Get index names
    SELECT array_agg(indexname) INTO index_names
    FROM pg_indexes 
    WHERE tablename = 'company_geofences' 
    AND indexname NOT LIKE '%pkey';
    
    RAISE NOTICE 'Found indexes: %', index_names;
    
    -- Get constraint names
    SELECT array_agg(conname) INTO constraint_names
    FROM pg_constraint
    WHERE conrelid = 'company_geofences'::regclass
    AND conname NOT LIKE '%pkey';
    
    RAISE NOTICE 'Found constraints: %', constraint_names;
END $$;

-- Drop the geography type constraint by recreating the table
-- This approach is safer than trying to alter the column type directly
BEGIN;

-- 1. Create a new table with the correct structure
CREATE TABLE company_geofences_new (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    coordinates geography(Point,4326) NOT NULL,
    radius NUMERIC(10,2),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Copy data from the old table, converting Polygons to Points (using the centroid)
INSERT INTO company_geofences_new (
    id, company_id, name, coordinates, radius, created_at, updated_at, created_by
)
SELECT 
    id, 
    company_id, 
    name, 
    -- Convert polygon to a point using ST_Centroid
    -- We need to cast to geometry first, find centroid, then cast back to geography
    ST_GeogFromWKB(ST_AsBinary(ST_Centroid(coordinates::geometry)))::geography(Point,4326),
    radius, 
    created_at, 
    updated_at, 
    created_by
FROM company_geofences;

-- 3. Drop the old table and rename the new one
DROP TABLE company_geofences;
ALTER TABLE company_geofences_new RENAME TO company_geofences;

-- 4. Recreate the sequence for the id column
ALTER SEQUENCE company_geofences_id_seq OWNED BY company_geofences.id;
SELECT setval('company_geofences_id_seq', (SELECT MAX(id) FROM company_geofences));

-- 5. Recreate indexes
CREATE INDEX idx_company_geofences_company ON company_geofences(company_id);
CREATE INDEX idx_company_geofences_active ON company_geofences(company_id) WHERE radius > 0;
CREATE INDEX idx_company_geofences_coordinates ON company_geofences USING GIST(coordinates);

-- 6. Recreate triggers
DROP TRIGGER IF EXISTS update_company_geofences_updated_at ON company_geofences;
CREATE TRIGGER update_company_geofences_updated_at
BEFORE UPDATE ON company_geofences
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_geofences_timestamp ON company_geofences;
CREATE TRIGGER update_geofences_timestamp
BEFORE UPDATE ON company_geofences
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

COMMIT;

-- Verify the change
DO $$
DECLARE
    column_type text;
BEGIN
    SELECT data_type || '(' || udt_name || ')' INTO column_type
    FROM information_schema.columns
    WHERE table_name = 'company_geofences' AND column_name = 'coordinates';
    
    RAISE NOTICE 'The coordinates column is now of type: %', column_type;
    
    -- Check if any foreign keys need to be recreated
    PERFORM 1 FROM pg_constraint
    WHERE conrelid = 'company_geofences'::regclass
    AND contype = 'f';
    
    IF FOUND THEN
        RAISE NOTICE 'Foreign keys were automatically created.';
    ELSE
        RAISE NOTICE 'You may need to manually recreate foreign keys.';
    END IF;
END $$;

-- Done!
SELECT 'Geography column type fixed successfully!' as result; 