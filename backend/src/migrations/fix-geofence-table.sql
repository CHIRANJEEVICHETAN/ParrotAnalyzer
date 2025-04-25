-- Script to verify and fix the company_geofences table

-- Check and create PostGIS extension if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'postgis'
    ) THEN
        CREATE EXTENSION postgis;
        RAISE NOTICE 'PostGIS extension created';
    ELSE
        RAISE NOTICE 'PostGIS extension already exists';
    END IF;
END
$$;

-- Check and fix the geometry type issue if table exists with wrong type
DO $$
DECLARE
    geom_type text;
    table_exists boolean;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'company_geofences'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Try to get the geometry type from geometry_columns view
        BEGIN
            SELECT type 
            INTO geom_type
            FROM geometry_columns
            WHERE f_table_name = 'company_geofences' AND f_geometry_column = 'coordinates';
            
            -- If not POINT, fix it
            IF geom_type IS NOT NULL AND geom_type != 'POINT' THEN
                RAISE NOTICE 'Fixing geometry type from % to POINT', geom_type;
                
                -- Create backup table if there's data to save
                IF EXISTS (SELECT 1 FROM company_geofences LIMIT 1) THEN
                    RAISE NOTICE 'Creating backup table company_geofences_backup';
                    DROP TABLE IF EXISTS company_geofences_backup;
                    CREATE TABLE company_geofences_backup AS SELECT * FROM company_geofences;
                END IF;
                
                -- Try to alter the column if possible (for empty tables)
                BEGIN
                    ALTER TABLE company_geofences ALTER COLUMN coordinates TYPE GEOMETRY(POINT, 4326);
                    RAISE NOTICE 'Successfully altered coordinates column type to POINT';
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Could not alter column type directly. Recreating column...';
                        
                        -- Drop and recreate the column with correct POINT type
                        ALTER TABLE company_geofences DROP COLUMN coordinates;
                        ALTER TABLE company_geofences ADD COLUMN coordinates GEOMETRY(POINT, 4326);
                        
                        -- If we had data, try to convert and restore it (using centroid for polygons)
                        IF EXISTS (SELECT 1 FROM company_geofences_backup LIMIT 1) THEN
                            BEGIN
                                RAISE NOTICE 'Attempting to restore data with converted geometry...';
                                UPDATE company_geofences g SET 
                                    coordinates = ST_Centroid(b.coordinates)
                                FROM company_geofences_backup b
                                WHERE g.id = b.id;
                                RAISE NOTICE 'Data restored with centroids of original geometries';
                            EXCEPTION
                                WHEN OTHERS THEN
                                    RAISE NOTICE 'Could not convert and restore geometries: %', SQLERRM;
                            END;
                        END IF;
                END;
            ELSE
                RAISE NOTICE 'Coordinates column is already using the correct POINT geometry type or no geometry type found';
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error checking geometry type: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Table company_geofences does not exist yet';
    END IF;
END
$$;

-- Create or update the company_geofences table
CREATE TABLE IF NOT EXISTS company_geofences (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    coordinates GEOMETRY(POINT, 4326) NOT NULL,
    radius FLOAT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Check for company_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_geofences' AND column_name='company_id') THEN
        ALTER TABLE company_geofences ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1;
    END IF;

    -- Check for radius column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_geofences' AND column_name='radius') THEN
        ALTER TABLE company_geofences ADD COLUMN radius FLOAT NOT NULL DEFAULT 100;
    END IF;

    -- Check for created_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_geofences' AND column_name='created_by') THEN
        ALTER TABLE company_geofences ADD COLUMN created_by INTEGER NOT NULL DEFAULT 1;
    END IF;

    -- Check for created_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_geofences' AND column_name='created_at') THEN
        ALTER TABLE company_geofences ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Check for updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_geofences' AND column_name='updated_at') THEN
        ALTER TABLE company_geofences ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END
$$;

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW(); 
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create trigger to update the updated_at column on each update
DROP TRIGGER IF EXISTS update_company_geofences_updated_at ON company_geofences;
CREATE TRIGGER update_company_geofences_updated_at
BEFORE UPDATE ON company_geofences
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Output the table structure for verification
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM 
    information_schema.columns 
WHERE 
    table_name = 'company_geofences' 
ORDER BY 
    ordinal_position;

-- For geometry columns, output the geometry type
SELECT 
    f_table_name, 
    f_geometry_column, 
    type, 
    srid
FROM 
    geometry_columns
WHERE 
    f_table_name = 'company_geofences'; 