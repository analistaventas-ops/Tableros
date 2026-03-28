-- SQL to fix the unique constraint on positions and ensure dashboard_name is used correctly

-- 1. Remove the unique constraint on 'name' if it exists
-- We need to find the constraint name first. Usually it's 'positions_name_key'
ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_name_key;

-- 2. Ensure dashboard_name column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'positions' AND COLUMN_NAME = 'dashboard_name') THEN
        ALTER TABLE positions ADD COLUMN dashboard_name TEXT;
    END IF;
END $$;

-- 3. Update existing positions that might have null dashboard_name
UPDATE positions SET dashboard_name = name WHERE dashboard_name IS NULL;
