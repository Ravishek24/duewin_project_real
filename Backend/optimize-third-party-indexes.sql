-- OPTIMIZATION: Database Indexes for Third-Party Games Statistics
-- This script creates optimized indexes for better query performance

-- 1. OPTIMIZED: Composite index for SpribeTransaction queries
-- This index will be used for the main statistics query
CREATE INDEX IF NOT EXISTS idx_spribe_stats_optimized 
ON spribe_transactions (user_id, status, created_at, type);

-- 2. OPTIMIZED: Composite index for SeamlessTransaction queries  
-- This index will be used for the main statistics query
CREATE INDEX IF NOT EXISTS idx_seamless_stats_optimized 
ON seamless_transactions (user_id, status, created_at, type);

-- 3. OPTIMIZED: Index for provider lookup in SeamlessTransaction
-- This index will be used for provider name extraction
CREATE INDEX IF NOT EXISTS idx_seamless_provider_lookup 
ON seamless_transactions (user_id, status, created_at, provider);

-- 4. OPTIMIZED: Index for history queries with pagination
-- This index will be used for transaction history with pagination
CREATE INDEX IF NOT EXISTS idx_spribe_history_optimized 
ON spribe_transactions (user_id, created_at DESC, status);

-- 5. OPTIMIZED: Index for Seamless history queries with pagination
-- This index will be used for transaction history with pagination
CREATE INDEX IF NOT EXISTS idx_seamless_history_optimized 
ON seamless_transactions (user_id, created_at DESC, status);

-- 6. OPTIMIZED: Index for jackpot and freeround queries
-- This index will be used for special transaction types
CREATE INDEX IF NOT EXISTS idx_seamless_special_types 
ON seamless_transactions (user_id, status, is_jackpot_win, is_freeround_bet, is_freeround_win);

-- 7. OPTIMIZED: Index for amount aggregations
-- This index will help with SUM operations on amount fields
CREATE INDEX IF NOT EXISTS idx_spribe_amount_agg 
ON spribe_transactions (user_id, status, type, amount);

CREATE INDEX IF NOT EXISTS idx_seamless_amount_agg 
ON seamless_transactions (user_id, status, type, amount);

-- 8. OPTIMIZED: Index for duplicate transaction checks
-- This index will be used for checking duplicate transactions
CREATE INDEX IF NOT EXISTS idx_spribe_duplicate_check 
ON spribe_transactions (provider_tx_id, user_id, type);

CREATE INDEX IF NOT EXISTS idx_seamless_duplicate_check 
ON seamless_transactions (provider_transaction_id, user_id, type);

-- 9. OPTIMIZED: Index for session-based queries
-- This index will be used for session-related operations
CREATE INDEX IF NOT EXISTS idx_spribe_session 
ON spribe_transactions (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_seamless_session 
ON seamless_transactions (session_id, created_at);

-- 10. OPTIMIZED: Index for game-specific queries
-- This index will be used for game-specific filtering
CREATE INDEX IF NOT EXISTS idx_spribe_game 
ON spribe_transactions (user_id, game_id, created_at);

CREATE INDEX IF NOT EXISTS idx_seamless_game 
ON seamless_transactions (user_id, game_id, created_at);

-- ANALYZE TABLES for better query planning
ANALYZE TABLE spribe_transactions;
ANALYZE TABLE seamless_transactions;

-- Show index usage statistics (MySQL 8.0+)
-- SELECT * FROM performance_schema.table_io_waits_summary_by_index_usage 
-- WHERE object_schema = DATABASE() 
-- AND object_name IN ('spribe_transactions', 'seamless_transactions');

-- OPTIMIZATION NOTES:
-- 1. These indexes are designed for the specific query patterns used in the statistics service
-- 2. The composite indexes include the most selective columns first (user_id, status)
-- 3. The DESC order on created_at helps with the ORDER BY created_at DESC queries
-- 4. The indexes support both the statistics aggregation queries and history pagination queries
-- 5. Consider dropping unused indexes if they're not being utilized by the query planner 