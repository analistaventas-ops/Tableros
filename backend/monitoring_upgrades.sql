-- Monitoring Upgrades: User Filtering & Usage Time Estimation
-- Run this in Supabase SQL Console

-- 1. Create heartbeats table to measure time spent
CREATE TABLE IF NOT EXISTS activity_heartbeats (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dashboard_url TEXT NOT NULL,
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, dashboard_url, last_ping) -- Avoid duplicates in the same second
);

-- 2. Update get_enhanced_stats to include user filter and time metrics
CREATE OR REPLACE FUNCTION get_enhanced_stats(
    start_date TEXT DEFAULT NULL, 
    end_date TEXT DEFAULT NULL,
    target_position_id BIGINT DEFAULT NULL,
    target_dashboard_name TEXT DEFAULT NULL,
    target_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    total_logins BIGINT;
    unique_users BIGINT;
    total_minutes_spent FLOAT;
    over_time_data JSON;
    by_position_data JSON;
    by_dashboard_data JSON;
    top_users_data JSON;
BEGIN
    -- 1. Base Metrics (Filtered)
    SELECT 
        COUNT(al.id), 
        COUNT(DISTINCT al.user_id)
    INTO total_logins, unique_users
    FROM access_logs al
    JOIN users u ON al.user_id = u.id
    LEFT JOIN user_positions up ON u.id = up.user_id
    LEFT JOIN dashboard_links dl ON al.dashboard_url = dl.url
    LEFT JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
    WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
      AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
      AND (target_position_id IS NULL OR up.position_id = target_position_id)
      AND (target_dashboard_name IS NULL OR dt.name = target_dashboard_name)
      AND (target_user_id IS NULL OR al.user_id = target_user_id);

    -- 2. Time Spent Metric (Calculated from heartbeats, assuming 30s per heartbeat)
    SELECT 
        COALESCE(COUNT(ah.id) * 0.5, 0) -- 0.5 minutes (30s) per ping
    INTO total_minutes_spent
    FROM activity_heartbeats ah
    JOIN users u ON ah.user_id = u.id
    LEFT JOIN user_positions up ON u.id = up.user_id
    LEFT JOIN dashboard_links dl ON ah.dashboard_url = dl.url
    LEFT JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
    WHERE (start_date IS NULL OR ah.last_ping >= start_date::TIMESTAMPTZ)
      AND (end_date IS NULL OR ah.last_ping <= end_date::TIMESTAMPTZ)
      AND (target_position_id IS NULL OR up.position_id = target_position_id)
      AND (target_dashboard_name IS NULL OR dt.name = target_dashboard_name)
      AND (target_user_id IS NULL OR ah.user_id = target_user_id);

    -- 3. Activity Over Time
    SELECT json_agg(t) INTO over_time_data
    FROM (
        SELECT 
            TO_CHAR(al.login_time AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') as date,
            COUNT(*) as count
        FROM access_logs al
        JOIN users u ON al.user_id = u.id
        LEFT JOIN user_positions up ON u.id = up.user_id
        LEFT JOIN dashboard_links dl ON al.dashboard_url = dl.url
        LEFT JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
        WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
          AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
          AND (target_position_id IS NULL OR up.position_id = target_position_id)
          AND (target_dashboard_name IS NULL OR dt.name = target_dashboard_name)
          AND (target_user_id IS NULL OR al.user_id = target_user_id)
        GROUP BY 1
        ORDER BY 1 ASC
    ) t;

    -- 4. Distribution by Position
    SELECT json_agg(t) INTO by_position_data
    FROM (
        SELECT 
            p.name,
            COUNT(al.id) as count
        FROM access_logs al
        JOIN users u ON al.user_id = u.id
        JOIN user_positions up ON u.id = up.user_id
        JOIN positions p ON up.position_id = p.id
        LEFT JOIN dashboard_links dl ON al.dashboard_url = dl.url
        LEFT JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
        WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
          AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
          AND (target_position_id IS NULL OR up.position_id = target_position_id)
          AND (target_dashboard_name IS NULL OR dt.name = target_dashboard_name)
          AND (target_user_id IS NULL OR al.user_id = target_user_id)
        GROUP BY p.name
        ORDER BY count DESC
    ) t;

    -- 5. Usage by Dashboard with Time Metric
    SELECT json_agg(t) INTO by_dashboard_data
    FROM (
        SELECT 
            COALESCE(dt.name, 'Otros/Login') as name,
            COUNT(al.id) as count,
            (
                SELECT COALESCE(COUNT(ah.id) * 0.5, 0)
                FROM activity_heartbeats ah
                WHERE ah.dashboard_url = dl.url
                  AND (start_date IS NULL OR ah.last_ping >= start_date::TIMESTAMPTZ)
                  AND (end_date IS NULL OR ah.last_ping <= end_date::TIMESTAMPTZ)
                  AND (target_user_id IS NULL OR ah.user_id = target_user_id)
            ) as minutes
        FROM access_logs al
        LEFT JOIN dashboard_links dl ON al.dashboard_url = dl.url
        LEFT JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
        JOIN users u ON al.user_id = u.id
        LEFT JOIN user_positions up ON u.id = up.user_id
        WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
          AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
          AND (target_position_id IS NULL OR up.position_id = target_position_id)
          AND (target_dashboard_name IS NULL OR dt.name = target_dashboard_name)
          AND (target_user_id IS NULL OR al.user_id = target_user_id)
        GROUP BY 1, dl.url
        ORDER BY count DESC
    ) t;

    -- 6. Top Active Users with Time Metric
    SELECT json_agg(t) INTO top_users_data
    FROM (
        SELECT 
            u.name,
            COUNT(al.id) as count,
            (
                SELECT COALESCE(COUNT(ah.id) * 0.5, 0)
                FROM activity_heartbeats ah
                WHERE ah.user_id = u.id
                  AND (start_date IS NULL OR ah.last_ping >= start_date::TIMESTAMPTZ)
                  AND (end_date IS NULL OR ah.last_ping <= end_date::TIMESTAMPTZ)
            ) as minutes
        FROM access_logs al
        JOIN users u ON al.user_id = u.id
        LEFT JOIN user_positions up ON u.id = up.user_id
        LEFT JOIN dashboard_links dl ON al.dashboard_url = dl.url
        LEFT JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
        WHERE (start_date IS NULL OR al.login_time >= start_date::TIMESTAMPTZ)
          AND (end_date IS NULL OR al.login_time <= end_date::TIMESTAMPTZ)
          AND (target_position_id IS NULL OR up.position_id = target_position_id)
          AND (target_dashboard_name IS NULL OR dt.name = target_dashboard_name)
          AND (target_user_id IS NULL OR al.user_id = target_user_id)
        GROUP BY u.name, u.id
        ORDER BY count DESC
        LIMIT 8
    ) t;

    -- Final result
    result := json_build_object(
        'kpis', json_build_object(
            'total_logins', COALESCE(total_logins, 0),
            'unique_users', COALESCE(unique_users, 0),
            'total_hours', ROUND((total_minutes_spent / 60)::numeric, 1)
        ),
        'over_time', COALESCE(over_time_data, '[]'::json),
        'by_position', COALESCE(by_position_data, '[]'::json),
        'by_dashboard', COALESCE(by_dashboard_data, '[]'::json),
        'top_users', COALESCE(top_users_data, '[]'::json)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;
