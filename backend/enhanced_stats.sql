-- SQL Script to update schema and create enhanced stats function
-- This script adds the dashboard_name column if it's missing and updates the analytics function

-- 1. Ensure dashboard_name exists in positions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'positions' AND COLUMN_NAME = 'dashboard_name') THEN
        ALTER TABLE positions ADD COLUMN dashboard_name TEXT;
    END IF;
END $$;

-- 2. Enhanced Stats Function with multiple filters
CREATE OR REPLACE FUNCTION get_enhanced_stats(
    start_date TEXT DEFAULT NULL, 
    end_date TEXT DEFAULT NULL,
    target_position_id BIGINT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    total_logins BIGINT;
    unique_users BIGINT;
    most_active_day TEXT;
    over_time_data JSON;
    by_position_data JSON;
    top_users_data JSON;
BEGIN
    -- Base filters
    -- If dates are null, we don't apply them or we use very old/future dates
    
    -- Calculate KPIs
    SELECT COUNT(*) INTO total_logins
    FROM access_logs al
    JOIN users u ON al.user_id = u.id
    WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
      AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
      AND (target_position_id IS NULL OR u.position_id = target_position_id);

    SELECT COUNT(DISTINCT user_id) INTO unique_users
    FROM access_logs al
    JOIN users u ON al.user_id = u.id
    WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
      AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
      AND (target_position_id IS NULL OR u.position_id = target_position_id);

    -- Over Time Data (GroupBy Day)
    SELECT json_agg(t) INTO over_time_data
    FROM (
        SELECT 
            TO_CHAR(al.login_time AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date,
            COUNT(*) as count
        FROM access_logs al
        JOIN users u ON al.user_id = u.id
        WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
          AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
          AND (target_position_id IS NULL OR u.position_id = target_position_id)
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
        JOIN positions p ON u.position_id = p.id
        WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
          AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
          AND (target_position_id IS NULL OR u.position_id = target_position_id)
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
          AND (target_position_id IS NULL OR u.position_id = target_position_id)
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
        'by_position', COALESCE(by_position_data, '[]'::json),
        'top_users', COALESCE(top_users_data, '[]'::json)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;
