-- MySQL Configuration to Prevent Deadlocks
-- Run these commands on your RDS MySQL instance

-- 1. Set appropriate lock wait timeout (default is 50 seconds)
SET GLOBAL innodb_lock_wait_timeout = 30;

-- 2. Enable deadlock detection and set retry count
SET GLOBAL innodb_deadlock_detect = ON;

-- 3. Set transaction isolation level to READ-COMMITTED (helps with deadlocks)
SET GLOBAL transaction_isolation = 'READ-COMMITTED';

-- 4. Optimize InnoDB settings for concurrent access
SET GLOBAL innodb_thread_concurrency = 0; -- Let InnoDB decide
SET GLOBAL innodb_read_io_threads = 8;
SET GLOBAL innodb_write_io_threads = 8;

-- 5. Set appropriate buffer pool size (adjust based on your RDS instance size)
-- For db.t3.micro: SET GLOBAL innodb_buffer_pool_size = 134217728; -- 128MB
-- For db.t3.small: SET GLOBAL innodb_buffer_pool_size = 268435456; -- 256MB
-- For db.t3.medium: SET GLOBAL innodb_buffer_pool_size = 536870912; -- 512MB

-- 6. Optimize log file size
SET GLOBAL innodb_log_file_size = 67108864; -- 64MB

-- 7. Set appropriate flush log at commit
SET GLOBAL innodb_flush_log_at_trx_commit = 2; -- Better performance, still safe

-- 8. Enable adaptive hash index
SET GLOBAL innodb_adaptive_hash_index = ON;

-- 9. Set appropriate page size
SET GLOBAL innodb_page_size = 16384; -- 16KB (default)

-- 10. Monitor current settings
SHOW VARIABLES LIKE 'innodb_lock_wait_timeout';
SHOW VARIABLES LIKE 'innodb_deadlock_detect';
SHOW VARIABLES LIKE 'transaction_isolation';
SHOW VARIABLES LIKE 'innodb_thread_concurrency';

-- 11. Check current deadlock status
SHOW ENGINE INNODB STATUS;

-- 12. Create indexes to reduce lock contention (if they don't exist)
-- These should be run on your specific tables
-- CREATE INDEX idx_user_id_status ON credit_transactions(user_id, status);
-- CREATE INDEX idx_user_id_created ON credit_transactions(user_id, created_at);
-- CREATE INDEX idx_user_id_game ON credit_transactions(user_id, game_type);

-- 13. Analyze table statistics
ANALYZE TABLE users;
ANALYZE TABLE credit_transactions;
ANALYZE TABLE self_rebates;
ANALYZE TABLE transactions;

-- Note: Some of these settings may require SUPER privilege on RDS
-- Contact AWS support if you need to modify restricted parameters
