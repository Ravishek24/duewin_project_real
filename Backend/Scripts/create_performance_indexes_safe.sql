-- 🚀 Performance Optimization Indexes (Safe Version)
-- This script checks for existing indexes before creating new ones
-- Run this to avoid "Duplicate key name" errors

-- Function to check if index exists and create if not
-- Note: This is a manual approach since MySQL doesn't support IF NOT EXISTS for CREATE INDEX

-- 1. User table indexes for bet processing
-- Check if indexes exist first, then create if they don't

-- Check for wallet_balance index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_wallet_balance';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_users_wallet_balance ON users(wallet_balance)', 'SELECT "Index idx_users_wallet_balance already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for total_bet_amount index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_total_bet_amount';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_users_total_bet_amount ON users(total_bet_amount)', 'SELECT "Index idx_users_total_bet_amount already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for vip_level index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_vip_level';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_users_vip_level ON users(vip_level)', 'SELECT "Index idx_users_vip_level already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Bet record indexes for fast queries
-- Check for bet_record_wingos composite index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'bet_record_wingos' AND index_name = 'idx_bet_wingo_user_period_created';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_bet_wingo_user_period_created ON bet_record_wingos(user_id, bet_number, created_at)', 'SELECT "Index idx_bet_wingo_user_period_created already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for bet_record_trx_wix index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'bet_record_trx_wix' AND index_name = 'idx_bet_trx_wix_user_period';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_bet_trx_wix_user_period ON bet_record_trx_wix(user_id, bet_number, created_at)', 'SELECT "Index idx_bet_trx_wix_user_period already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for bet_record_k3s index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'bet_record_k3s' AND index_name = 'idx_bet_k3_user_period';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_bet_k3_user_period ON bet_record_k3s(user_id, bet_number, created_at)', 'SELECT "Index idx_bet_k3_user_period already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for bet_record_5ds index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'bet_record_5ds' AND index_name = 'idx_bet_5d_user_period';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_bet_5d_user_period ON bet_record_5ds(user_id, bet_number, created_at)', 'SELECT "Index idx_bet_5d_user_period already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Bet record status indexes for result processing
-- Check for bet_record_wingos status index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'bet_record_wingos' AND index_name = 'idx_bet_wingo_status_period';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_bet_wingo_status_period ON bet_record_wingos(status, bet_number)', 'SELECT "Index idx_bet_wingo_status_period already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for bet_record_trx_wix status index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'bet_record_trx_wix' AND index_name = 'idx_bet_trx_wix_status_period';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_bet_trx_wix_status_period ON bet_record_trx_wix(status, bet_number)', 'SELECT "Index idx_bet_trx_wix_status_period already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for bet_record_k3s status index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'bet_record_k3s' AND index_name = 'idx_bet_k3_status_period';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_bet_k3_status_period ON bet_record_k3s(status, bet_number)', 'SELECT "Index idx_bet_k3_status_period already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for bet_record_5ds status index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'bet_record_5ds' AND index_name = 'idx_bet_5d_status_period';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_bet_5d_status_period ON bet_record_5ds(status, bet_number)', 'SELECT "Index idx_bet_5d_status_period already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Transaction indexes for wallet operations
-- Check for transactions user_type index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'transactions' AND index_name = 'idx_transactions_user_type';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_transactions_user_type ON transactions(user_id, type, created_at)', 'SELECT "Index idx_transactions_user_type already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for transactions status index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'transactions' AND index_name = 'idx_transactions_status';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_transactions_status ON transactions(status, created_at)', 'SELECT "Index idx_transactions_status already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. VIP experience indexes
-- Check for vip_experience_history index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'vip_experience_history' AND index_name = 'idx_vip_experience_user_date';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_vip_experience_user_date ON vip_experience_history(user_id, created_at)', 'SELECT "Index idx_vip_experience_user_date already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for vip_rewards index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'vip_rewards' AND index_name = 'idx_vip_rewards_user_status';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_vip_rewards_user_status ON vip_rewards(user_id, status, created_at)', 'SELECT "Index idx_vip_rewards_user_status already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Self rebate indexes
-- Check for self_rebates user_game index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'self_rebates' AND index_name = 'idx_self_rebates_user_game';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_self_rebates_user_game ON self_rebates(user_id, game_type, created_at)', 'SELECT "Index idx_self_rebates_user_game already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for self_rebates status index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'self_rebates' AND index_name = 'idx_self_rebates_status';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_self_rebates_status ON self_rebates(status, created_at)', 'SELECT "Index idx_self_rebates_status already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. Activity rewards indexes
-- Check for activity_rewards user_date index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'activity_rewards' AND index_name = 'idx_activity_rewards_user_date';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_activity_rewards_user_date ON activity_rewards(user_id, date)', 'SELECT "Index idx_activity_rewards_user_date already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for activity_rewards date index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'activity_rewards' AND index_name = 'idx_activity_rewards_date';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_activity_rewards_date ON activity_rewards(date)', 'SELECT "Index idx_activity_rewards_date already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. Rebate team indexes for referral system
-- Check for rebet_team_table user_level index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'rebet_team_table' AND index_name = 'idx_rebet_team_user_level';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_rebet_team_user_level ON rebet_team_table(user_id, current_rebet_level)', 'SELECT "Index idx_rebet_team_user_level already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for rebet_team_table betting index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'rebet_team_table' AND index_name = 'idx_rebet_team_betting';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_rebet_team_betting ON rebet_team_table(current_team_betting)', 'SELECT "Index idx_rebet_team_betting already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 9. Referral commission indexes
-- Check for referralcommission user_type index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'referralcommission' AND index_name = 'idx_referral_commission_user_type';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_referral_commission_user_type ON referralcommission(user_id, type, created_at)', 'SELECT "Index idx_referral_commission_user_type already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for referralcommission status index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'referralcommission' AND index_name = 'idx_referral_commission_status';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_referral_commission_status ON referralcommission(status, created_at)', 'SELECT "Index idx_referral_commission_status already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 10. Composite indexes for complex queries
-- Check for users composite_bet index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_composite_bet';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_users_composite_bet ON users(user_id, wallet_balance, total_bet_amount)', 'SELECT "Index idx_users_composite_bet already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for bet_record_wingos composite_processing index
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'bet_record_wingos' AND index_name = 'idx_bet_composite_processing';
SET @sql = IF(@index_exists = 0, 'CREATE INDEX idx_bet_composite_processing ON bet_record_wingos(user_id, status, bet_number, created_at)', 'SELECT "Index idx_bet_composite_processing already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Show final results
SELECT 'Performance indexes creation completed!' as status;

-- Verify key indexes were created
SHOW INDEX FROM users WHERE Key_name LIKE 'idx_users_%';
SHOW INDEX FROM bet_record_wingos WHERE Key_name LIKE 'idx_bet_%';
SHOW INDEX FROM transactions WHERE Key_name LIKE 'idx_transactions_%'; 