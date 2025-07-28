-- 🚀 Performance Optimization Indexes (MySQL Compatible)
-- Run this script to add critical indexes for bet processing performance
-- This version works with MySQL versions that don't support IF NOT EXISTS for CREATE INDEX

-- 1. User table indexes for bet processing
CREATE INDEX idx_users_wallet_balance ON users(wallet_balance);
CREATE INDEX idx_users_total_bet_amount ON users(total_bet_amount);
CREATE INDEX idx_users_vip_level ON users(vip_level);

-- 2. Bet record indexes for fast queries (only add if they don't exist)
-- Note: Some of these might already exist based on your SHOW INDEX output

-- For bet_record_wingos (checking existing indexes first)
-- You already have: bet_record_wingos_user_period_index (user_id, bet_number)
-- You already have: idx_bet_user_created (user_id, created_at)
-- Adding missing composite index:
CREATE INDEX idx_bet_wingo_user_period_created ON bet_record_wingos(user_id, bet_number, created_at);

-- For other bet tables
CREATE INDEX idx_bet_trx_wix_user_period ON bet_record_trx_wix(user_id, bet_number, created_at);
CREATE INDEX idx_bet_k3_user_period ON bet_record_k3s(user_id, bet_number, created_at);
CREATE INDEX idx_bet_5d_user_period ON bet_record_5ds(user_id, bet_number, created_at);

-- 3. Bet record status indexes for result processing
-- You already have: idx_status on bet_record_wingos
-- Adding composite status indexes:
CREATE INDEX idx_bet_wingo_status_period ON bet_record_wingos(status, bet_number);
CREATE INDEX idx_bet_trx_wix_status_period ON bet_record_trx_wix(status, bet_number);
CREATE INDEX idx_bet_k3_status_period ON bet_record_k3s(status, bet_number);
CREATE INDEX idx_bet_5d_status_period ON bet_record_5ds(status, bet_number);

-- 4. Transaction indexes for wallet operations
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type, created_at);
CREATE INDEX idx_transactions_status ON transactions(status, created_at);

-- 5. VIP experience indexes
CREATE INDEX idx_vip_experience_user_date ON vip_experience_history(user_id, created_at);
CREATE INDEX idx_vip_rewards_user_status ON vip_rewards(user_id, status, created_at);

-- 6. Self rebate indexes
CREATE INDEX idx_self_rebates_user_game ON self_rebates(user_id, game_type, created_at);
CREATE INDEX idx_self_rebates_status ON self_rebates(status, created_at);

-- 7. Activity rewards indexes
CREATE INDEX idx_activity_rewards_user_date ON activity_rewards(user_id, date);
CREATE INDEX idx_activity_rewards_date ON activity_rewards(date);

-- 8. Rebate team indexes for referral system
CREATE INDEX idx_rebet_team_user_level ON rebet_team_table(user_id, current_rebet_level);
CREATE INDEX idx_rebet_team_betting ON rebet_team_table(current_team_betting);

-- 9. Referral commission indexes
CREATE INDEX idx_referral_commission_user_type ON referralcommission(user_id, type, created_at);
CREATE INDEX idx_referral_commission_status ON referralcommission(status, created_at);

-- 10. Composite indexes for complex queries
CREATE INDEX idx_users_composite_bet ON users(user_id, wallet_balance, total_bet_amount);
CREATE INDEX idx_bet_composite_processing ON bet_record_wingos(user_id, status, bet_number, created_at);

-- Verify indexes were created
SHOW INDEX FROM users;
SHOW INDEX FROM bet_record_wingos;
SHOW INDEX FROM transactions; 