-- SQL Script to migrate to Dashboard Matrix Model
-- Run this in the Supabase SQL Console

-- 1. Create dashboard_types table
CREATE TABLE IF NOT EXISTS dashboard_types (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create dashboard_links table (The Matrix)
CREATE TABLE IF NOT EXISTS dashboard_links (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    position_id BIGINT REFERENCES positions(id) ON DELETE CASCADE,
    dashboard_type_id BIGINT REFERENCES dashboard_types(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(position_id, dashboard_type_id)
);

-- 3. Initial Migration from existing positions to dashboard_types and dashboard_links
DO $$
DECLARE
    pos_record RECORD;
    type_id BIGINT;
BEGIN
    FOR pos_record IN SELECT id, name, dashboard_url, dashboard_name FROM positions WHERE dashboard_url IS NOT NULL LOOP
        -- Ensure we have a dashboard_type
        INSERT INTO dashboard_types (name) 
        VALUES (COALESCE(pos_record.dashboard_name, pos_record.name)) 
        ON CONFLICT (name) DO NOTHING;
        
        -- Get the type_id
        SELECT id INTO type_id FROM dashboard_types WHERE name = COALESCE(pos_record.dashboard_name, pos_record.name);
        
        -- Create the link
        INSERT INTO dashboard_links (position_id, dashboard_type_id, url)
        VALUES (pos_record.id, type_id, pos_record.dashboard_url)
        ON CONFLICT (position_id, dashboard_type_id) DO NOTHING;
    END LOOP;
END $$;

-- 4. Update get_enhanced_stats function to support the new schema
CREATE OR REPLACE FUNCTION get_enhanced_stats(
    start_date TEXT DEFAULT NULL, 
    end_date TEXT DEFAULT NULL,
    target_position_id BIGINT DEFAULT NULL,
    target_dashboard_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    total_logins BIGINT;
    unique_users BIGINT;
    over_time_data JSON;
    over_time_month_data JSON;
    by_position_data JSON;
    top_users_data JSON;
BEGIN
    -- Calculate KPIs
    SELECT COUNT(*) INTO total_logins
    FROM access_logs al
    JOIN users u ON al.user_id = u.id
    LEFT JOIN user_positions up ON u.id = up.user_id
    LEFT JOIN positions p ON up.position_id = p.id
    WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
      AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
      AND (target_position_id IS NULL OR up.position_id = target_position_id);
      -- Filter by dashboard name is harder now, we skip it for KPIs for now unless specifically asked

    SELECT COUNT(DISTINCT al.user_id) INTO unique_users
    FROM access_logs al
    JOIN users u ON al.user_id = u.id
    LEFT JOIN user_positions up ON u.id = up.user_id
    WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
      AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
      AND (target_position_id IS NULL OR up.position_id = target_position_id);

    -- Over Time Data (GroupBy Day)
    SELECT json_agg(t) INTO over_time_data
    FROM (
        SELECT 
            TO_CHAR(al.login_time AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') as date,
            COUNT(*) as count
        FROM access_logs al
        JOIN users u ON al.user_id = u.id
        LEFT JOIN user_positions up ON u.id = up.user_id
        WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
          AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
          AND (target_position_id IS NULL OR up.position_id = target_position_id)
        GROUP BY 1
        ORDER BY 1 ASC
    ) t;

    -- Over Time Data (GroupBy Month)
    SELECT json_agg(t) INTO over_time_month_data
    FROM (
        SELECT 
            TO_CHAR(al.login_time AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') as month,
            COUNT(*) as count
        FROM access_logs al
        JOIN users u ON al.user_id = u.id
        LEFT JOIN user_positions up ON u.id = up.user_id
        WHERE (target_position_id IS NULL OR up.position_id = target_position_id)
        GROUP BY 1
        ORDER BY 1 ASC
    ) t;

    -- By Position Data
    SELECT json_agg(t) INTO by_position_data
    FROM (
        SELECT 
            p.name,
            COUNT(al.id) as count
        FROM access_logs al
        JOIN users u ON al.user_id = u.id
        JOIN user_positions up ON u.id = up.user_id
        JOIN positions p ON up.position_id = p.id
        WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
          AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
          AND (target_position_id IS NULL OR up.position_id = target_position_id)
        GROUP BY p.name
        ORDER BY count DESC
    ) t;

    -- Top Users
    SELECT json_agg(t) INTO top_users_data
    FROM (
        SELECT 
            u.name,
            COUNT(al.id) as count
        FROM access_logs al
        JOIN users u ON al.user_id = u.id
        WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
          AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
        GROUP BY u.name
        ORDER BY count DESC
        LIMIT 5
    ) t;

    -- Final result
    result := json_build_object(
        'kpis', json_build_object(
            'total_logins', total_logins,
            'unique_users', unique_users
        ),
        'over_time', COALESCE(over_time_data, '[]'::json),
        'over_time_month', COALESCE(over_time_month_data, '[]'::json),
        'by_position', COALESCE(by_position_data, '[]'::json),
        'top_users', COALESCE(top_users_data, '[]'::json)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 5. FINAL CLEANUP (Run ONLY after verifying the matrix model works)
-- WARNING: These commands delete data. Run only when you are sure the new 'dashboard_links' table contains all your URLs.
/*
ALTER TABLE positions DROP COLUMN IF EXISTS dashboard_url;
ALTER TABLE positions DROP COLUMN IF EXISTS dashboard_name;
*/

