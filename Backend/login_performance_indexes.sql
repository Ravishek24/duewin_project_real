-- SQL commands to optimize login performance
-- Run these commands directly in your MySQL database

-- 1. Index for users table phone_no lookup (login query)
CREATE INDEX idx_users_phone_no_login ON users(phone_no);

-- 2. Index for user sessions by user_id and active status (session invalidation)
CREATE INDEX idx_user_sessions_user_active ON user_sessions(user_id, is_active);

-- 3. Index for session token lookup (session validation)
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);

-- 4. Index for session expiration cleanup
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- 5. Index for session invalidations lookup
CREATE INDEX idx_session_invalidations_user_time ON session_invalidations(user_id, invalidated_at);

-- Verify indexes were created
SHOW INDEX FROM users WHERE Key_name LIKE 'idx_users_phone_no_login';
SHOW INDEX FROM user_sessions WHERE Key_name LIKE 'idx_user_sessions_%';
SHOW INDEX FROM session_invalidations WHERE Key_name LIKE 'idx_session_invalidations_%';