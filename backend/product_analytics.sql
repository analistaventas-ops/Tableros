-- SQL Script to upgrade get_enhanced_stats for Advanced Product Analytics (UTC-3 Focused)
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
    curr_start DATE;
    curr_end DATE;
    prev_start DATE;
    prev_end DATE;
    days_diff INTEGER;
    today_ar DATE;
    
    -- Current Period Stats
    curr_total_minutes BIGINT;
    curr_total_sessions BIGINT;
    curr_unique_users BIGINT;
    curr_active_30d BIGINT;
    total_users_count BIGINT;
    top_dashboard_name TEXT;
    top_dashboard_count BIGINT;
    
    -- Previous Period Stats
    prev_total_minutes BIGINT;
    prev_total_sessions BIGINT;
    prev_unique_users BIGINT;
    
    -- Other data
    over_time_data JSON;
    by_dashboard_data JSON;
    by_position_data JSON;
    top_users_data JSON;
    engagement_data JSON;
    
BEGIN
    -- 0. Set Date Ranges and Timezone (America/Argentina/Buenos_Aires)
    today_ar := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    curr_end := COALESCE(end_date::DATE, today_ar);
    curr_start := COALESCE(start_date::DATE, curr_end - INTERVAL '7 days');
    days_diff := (curr_end - curr_start) + 1;
    
    prev_end := curr_start - INTERVAL '1 day';
    prev_start := prev_end - (days_diff - 1) * INTERVAL '1 day';

    -- 1. Base Metrics - Current Period
    SELECT 
        COALESCE(SUM(duration_minutes), 0),
        COUNT(*),
        COUNT(DISTINCT user_id)
    INTO curr_total_minutes, curr_total_sessions, curr_unique_users
    FROM activity_sessions s
    WHERE s.session_date BETWEEN curr_start AND curr_end
      AND (target_user_id IS NULL OR s.user_id = target_user_id)
      AND (target_position_id IS NULL OR EXISTS (SELECT 1 FROM user_positions up WHERE up.user_id = s.user_id AND up.position_id = target_position_id))
      AND (target_dashboard_name IS NULL OR EXISTS (
          SELECT 1 FROM dashboard_links dl JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id 
          WHERE dl.url = s.dashboard_url AND dt.name = target_dashboard_name
      ));

    -- 2. Base Metrics - Previous Period (for variations)
    SELECT 
        COALESCE(SUM(duration_minutes), 0),
        COUNT(*),
        COUNT(DISTINCT user_id)
    INTO prev_total_minutes, prev_total_sessions, prev_unique_users
    FROM activity_sessions s
    WHERE s.session_date BETWEEN prev_start AND prev_end
      AND (target_user_id IS NULL OR s.user_id = target_user_id)
      AND (target_position_id IS NULL OR EXISTS (SELECT 1 FROM user_positions up WHERE up.user_id = s.user_id AND up.position_id = target_position_id))
      AND (target_dashboard_name IS NULL OR EXISTS (
          SELECT 1 FROM dashboard_links dl JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id 
          WHERE dl.url = s.dashboard_url AND dt.name = target_dashboard_name
      ));

    -- 3. Global Stats (Adoption & Inactivity)
    SELECT COUNT(*) INTO total_users_count FROM users;
    
    SELECT COUNT(DISTINCT user_id) INTO curr_active_30d 
    FROM activity_sessions 
    WHERE session_date >= (today_ar - INTERVAL '30 days');

    -- 4. Top Dashboard info
    SELECT dt.name, COUNT(*) as sessions
    INTO top_dashboard_name, top_dashboard_count
    FROM activity_sessions s
    JOIN dashboard_links dl ON s.dashboard_url = dl.url
    JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
    WHERE s.session_date BETWEEN curr_start AND curr_end
    GROUP BY 1
    ORDER BY sessions DESC
    LIMIT 1;

    -- 5. Over Time Data
    SELECT json_agg(t) INTO over_time_data
    FROM (
        WITH date_series AS (
            SELECT generate_series(curr_start, curr_end, '1 day'::interval)::date as d
        )
        SELECT 
            ds.d as date,
            COALESCE(count, 0) as count
        FROM date_series ds
        LEFT JOIN (
            SELECT session_date as date, COUNT(*) as count 
            FROM activity_sessions 
            WHERE session_date BETWEEN curr_start AND curr_end
            GROUP BY 1
        ) s ON ds.d = s.date
        ORDER BY ds.d ASC
    ) t;

    -- 6. By Dashboard Breakdown
    SELECT json_agg(t) INTO by_dashboard_data
    FROM (
        SELECT 
            COALESCE(dt.name, 'Portal/Login') as name,
            COUNT(*) as count
        FROM activity_sessions s
        LEFT JOIN dashboard_links dl ON s.dashboard_url = dl.url
        LEFT JOIN dashboard_types dt ON dl.dashboard_type_id = dt.id
        WHERE s.session_date BETWEEN curr_start AND curr_end
        GROUP BY 1
        ORDER BY count DESC
    ) t;

    -- 7. By Position Breakdown
    SELECT json_agg(t) INTO by_position_data
    FROM (
        SELECT 
            p.name,
            COUNT(s.id) as count
        FROM positions p
        JOIN user_positions up ON p.id = up.position_id
        JOIN activity_sessions s ON up.user_id = s.user_id
        WHERE s.session_date BETWEEN curr_start AND curr_end
        GROUP BY p.name
        ORDER BY count DESC
    ) t;

    -- 8. Engagement Histogram
    SELECT json_agg(t) INTO engagement_data
    FROM (
        SELECT 
            segment,
            COUNT(*) as user_count
        FROM (
            SELECT 
                user_id,
                CASE 
                    WHEN COUNT(*) = 1 THEN '1 Sesión'
                    WHEN COUNT(*) BETWEEN 2 AND 5 THEN '2-5 Sesiones'
                    WHEN COUNT(*) BETWEEN 6 AND 10 THEN '6-10 Sesiones'
                    ELSE '+10 Sesiones'
                END as segment
            FROM activity_sessions
            WHERE session_date BETWEEN curr_start AND curr_end
            GROUP BY user_id
        ) s
        GROUP BY 1
    ) t;

    -- 9. Top Users list
    SELECT json_agg(t) INTO top_users_data
    FROM (
        SELECT 
            u.name,
            COUNT(s.id) as sessions,
            SUM(s.duration_minutes) as minutes
        FROM users u
        JOIN activity_sessions s ON u.id = s.user_id
        WHERE s.session_date BETWEEN curr_start AND curr_end
        GROUP BY 1
        ORDER BY sessions DESC
        LIMIT 10
    ) t;

    -- 10. Final Construct
    result := json_build_object(
        'kpis', json_build_object(
            'active_users_30d', curr_active_30d,
            'adoption_rate', ROUND((curr_active_30d::numeric / NULLIF(total_users_count, 0)) * 100, 1),
            'total_sessions', curr_total_sessions,
            'avg_sessions_user', ROUND(curr_total_sessions::numeric / NULLIF(curr_unique_users, 0), 1),
            'avg_time_session', ROUND(curr_total_minutes::numeric / NULLIF(curr_total_sessions, 0), 1),
            'top_dashboard', json_build_object('name', COALESCE(top_dashboard_name, 'N/A'), 'count', COALESCE(top_dashboard_count, 0)),
            'inactive_users_count', (total_users_count - curr_active_30d),
            
            -- Variations
            'var_active_30d', CASE WHEN prev_unique_users > 0 THEN ROUND(((curr_unique_users - prev_unique_users)::numeric / prev_unique_users) * 100) ELSE 0 END,
            'var_sessions', CASE WHEN prev_total_sessions > 0 THEN ROUND(((curr_total_sessions - prev_total_sessions)::numeric / prev_total_sessions) * 100) ELSE 0 END,
            'var_time', CASE WHEN prev_total_minutes > 0 THEN ROUND(((curr_total_minutes - prev_total_minutes)::numeric / prev_total_minutes) * 100) ELSE 0 END
        ),
        'over_time', COALESCE(over_time_data, '[]'::json),
        'by_dashboard', COALESCE(by_dashboard_data, '[]'::json),
        'by_position', COALESCE(by_position_data, '[]'::json),
        'engagement', COALESCE(engagement_data, '[]'::json),
        'top_users', COALESCE(top_users_data, '[]'::json)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;
