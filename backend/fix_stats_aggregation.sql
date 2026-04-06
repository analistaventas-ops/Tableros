-- SQL Script to fix get_enhanced_stats aggregation issue
CREATE OR REPLACE FUNCTION get_enhanced_stats(
    start_date TEXT DEFAULT NULL, 
    end_date TEXT DEFAULT NULL,
    target_position_id BIGINT DEFAULT NULL,
    target_dashboard_name TEXT DEFAULT NULL,
    target_user_id BIGINT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    total_minutes BIGINT;
    unique_users BIGINT;
    over_time_data JSON;
    by_position_data JSON;
    by_dashboard_data JSON;
    top_users_data JSON;
BEGIN
    -- Ensure we use defaults for null dates to get all data if not specified
    -- start_date and end_date come as YYYY-MM-DD

    -- 1. Calculate KPIs
    SELECT 
        COALESCE(SUM(duration_minutes), 0),
        COUNT(DISTINCT user_id)
    INTO total_minutes, unique_users
    FROM activity_sessions s
    WHERE (start_date IS NULL OR s.session_date >= start_date::DATE)
      AND (end_date IS NULL OR s.session_date <= end_date::DATE)
      AND (target_user_id IS NULL OR s.user_id = target_user_id)
      AND (target_position_id IS NULL OR EXISTS (
          SELECT 1 FROM user_positions up 
          WHERE up.user_id = s.user_id AND up.position_id = target_position_id
      ))
      AND (target_dashboard_name IS NULL OR EXISTS (
          SELECT 1 FROM dashboard_links dl 
          JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
          WHERE dl.url = s.dashboard_url AND dt.name = target_dashboard_name
      ));

    -- 2. Over Time Data
    SELECT json_agg(t) INTO over_time_data
    FROM (
        SELECT 
            s.session_date::TEXT as date,
            COUNT(*) as count
        FROM activity_sessions s
        WHERE (start_date IS NULL OR s.session_date >= start_date::DATE)
          AND (end_date IS NULL OR s.session_date <= end_date::DATE)
          AND (target_user_id IS NULL OR s.user_id = target_user_id)
          AND (target_position_id IS NULL OR EXISTS (
              SELECT 1 FROM user_positions up 
              WHERE up.user_id = s.user_id AND up.position_id = target_position_id
          ))
          AND (target_dashboard_name IS NULL OR EXISTS (
              SELECT 1 FROM dashboard_links dl 
              JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
              WHERE dl.url = s.dashboard_url AND dt.name = target_dashboard_name
          ))
        GROUP BY 1
        ORDER BY 1 ASC
    ) t;

    -- 3. By Dashboard
    SELECT json_agg(t) INTO by_dashboard_data
    FROM (
        SELECT 
            COALESCE(dt.name, 'Portal/Login') as name,
            COUNT(*) as count
        FROM activity_sessions s
        LEFT JOIN dashboard_links dl ON s.dashboard_url = dl.url
        LEFT JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
        WHERE (start_date IS NULL OR s.session_date >= start_date::DATE)
          AND (end_date IS NULL OR s.session_date <= end_date::DATE)
          AND (target_user_id IS NULL OR s.user_id = target_user_id)
          AND (target_position_id IS NULL OR EXISTS (
              SELECT 1 FROM user_positions up 
              WHERE up.user_id = s.user_id AND up.position_id = target_position_id
          ))
          AND (target_dashboard_name IS NULL OR dt.name = target_dashboard_name)
        GROUP BY 1
        ORDER BY count DESC
    ) t;

    -- 4. By Position
    SELECT json_agg(t) INTO by_position_data
    FROM (
        SELECT 
            p.name,
            COUNT(*) as count
        FROM activity_sessions s
        JOIN user_positions up ON s.user_id = up.user_id
        JOIN positions p ON up.position_id = p.id
        WHERE (start_date IS NULL OR s.session_date >= start_date::DATE)
          AND (end_date IS NULL OR s.session_date <= end_date::DATE)
          AND (target_user_id IS NULL OR s.user_id = target_user_id)
          AND (target_position_id IS NULL OR p.id = target_position_id)
          AND (target_dashboard_name IS NULL OR EXISTS (
              SELECT 1 FROM dashboard_links dl 
              JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
              WHERE dl.url = s.dashboard_url AND dt.name = target_dashboard_name
          ))
        GROUP BY p.name
        ORDER BY count DESC
    ) t;

    -- 5. Top Users
    SELECT json_agg(t) INTO top_users_data
    FROM (
        SELECT 
            u.name,
            SUM(s.duration_minutes) as minutes
        FROM activity_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE (start_date IS NULL OR s.session_date >= start_date::DATE)
          AND (end_date IS NULL OR s.session_date <= end_date::DATE)
          AND (target_user_id IS NULL OR s.user_id = target_user_id)
          AND (target_dashboard_name IS NULL OR EXISTS (
              SELECT 1 FROM dashboard_links dl 
              JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
              WHERE dl.url = s.dashboard_url AND dt.name = target_dashboard_name
          ))
        GROUP BY u.name
        ORDER BY minutes DESC
        LIMIT 10
    ) t;

    -- FINAL RESULT
    result := json_build_object(
        'kpis', json_build_object(
            'total_hours', ROUND(total_minutes / 60.0),
            'unique_users', COALESCE(unique_users, 0)
        ),
        'over_time', COALESCE(over_time_data, '[]'::json),
        'by_dashboard', COALESCE(by_dashboard_data, '[]'::json),
        'by_position', COALESCE(by_position_data, '[]'::json),
        'top_users', COALESCE(top_users_data, '[]'::json)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;
