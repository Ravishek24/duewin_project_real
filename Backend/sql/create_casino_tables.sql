-- =====================================================
-- Casino Tables Creation SQL Script
-- Compatible with MySQL
-- =====================================================

-- 1. Create Casino Game Sessions Table
-- ====================================
CREATE TABLE `casino_game_sessions` (
  `session_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `member_account` varchar(50) NOT NULL COMMENT 'Player account name used in casino API',
  `game_uid` varchar(50) NOT NULL COMMENT 'Game UID from casino provider',
  `session_token` varchar(255) DEFAULT NULL COMMENT 'Session token from casino provider',
  `game_launch_url` text NOT NULL COMMENT 'Game launch URL from casino provider',
  `credit_amount` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Credit amount allocated for this session',
  `currency_code` varchar(3) NOT NULL DEFAULT 'USD' COMMENT 'Currency code for this session',
  `language` varchar(5) NOT NULL DEFAULT 'en' COMMENT 'Game language',
  `platform` varchar(10) NOT NULL DEFAULT 'web' COMMENT 'Platform (web, H5)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether session is currently active',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP address of the player',
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When the session started',
  `closed_at` datetime DEFAULT NULL COMMENT 'When the session was closed',
  `last_activity` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last activity timestamp',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  KEY `idx_casino_sessions_user_id` (`user_id`),
  KEY `idx_casino_sessions_member_account` (`member_account`),
  KEY `idx_casino_sessions_session_token` (`session_token`),
  KEY `idx_casino_sessions_is_active` (`is_active`),
  KEY `idx_casino_sessions_started_at` (`started_at`),
  CONSTRAINT `fk_casino_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Casino game sessions tracking';

-- 2. Create Casino Transactions Table
-- ===================================
CREATE TABLE `casino_transactions` (
  `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) DEFAULT NULL COMMENT 'Reference to game session',
  `user_id` int(11) NOT NULL,
  `serial_number` varchar(100) NOT NULL COMMENT 'Unique transaction ID from casino provider',
  `member_account` varchar(50) NOT NULL COMMENT 'Player account name',
  `game_uid` varchar(50) NOT NULL COMMENT 'Game UID from casino provider',
  `transaction_type` enum('bet','win','balance','rollback') NOT NULL COMMENT 'Type of transaction',
  `bet_amount` decimal(15,2) DEFAULT '0.00' COMMENT 'Bet amount (for bet transactions)',
  `win_amount` decimal(15,2) DEFAULT '0.00' COMMENT 'Win amount (for win transactions)',
  `currency_code` varchar(3) NOT NULL DEFAULT 'USD' COMMENT 'Currency code for transaction',
  `timestamp` bigint(20) NOT NULL COMMENT 'Transaction timestamp from casino provider',
  `game_round` varchar(100) DEFAULT NULL COMMENT 'Game round ID',
  `data` json DEFAULT NULL COMMENT 'Additional transaction data from casino provider',
  `wallet_balance_before` decimal(15,2) DEFAULT NULL COMMENT 'Wallet balance before transaction',
  `wallet_balance_after` decimal(15,2) DEFAULT NULL COMMENT 'Wallet balance after transaction',
  `status` enum('pending','completed','failed','rolled_back') NOT NULL DEFAULT 'pending' COMMENT 'Transaction status',
  `error_message` text DEFAULT NULL COMMENT 'Error message if transaction failed',
  `processed_at` datetime DEFAULT NULL COMMENT 'When transaction was processed',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`transaction_id`),
  UNIQUE KEY `idx_casino_transactions_serial_number` (`serial_number`),
  KEY `idx_casino_transactions_user_id` (`user_id`),
  KEY `idx_casino_transactions_session_id` (`session_id`),
  KEY `idx_casino_transactions_transaction_type` (`transaction_type`),
  KEY `idx_casino_transactions_timestamp` (`timestamp`),
  KEY `idx_casino_transactions_status` (`status`),
  KEY `idx_casino_transactions_created_at` (`created_at`),
  CONSTRAINT `fk_casino_transactions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_casino_transactions_session_id` FOREIGN KEY (`session_id`) REFERENCES `casino_game_sessions` (`session_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Casino transaction records';

-- =====================================================
-- Indexes for Performance (Additional)
-- =====================================================

-- Performance indexes for common queries
CREATE INDEX `idx_casino_sessions_user_active` ON `casino_game_sessions` (`user_id`, `is_active`);
CREATE INDEX `idx_casino_sessions_game_active` ON `casino_game_sessions` (`game_uid`, `is_active`);
CREATE INDEX `idx_casino_transactions_user_type` ON `casino_transactions` (`user_id`, `transaction_type`);
CREATE INDEX `idx_casino_transactions_game_type` ON `casino_transactions` (`game_uid`, `transaction_type`);
CREATE INDEX `idx_casino_transactions_status_type` ON `casino_transactions` (`status`, `transaction_type`);

-- =====================================================
-- Sample Data Insert (Optional)
-- =====================================================

-- Uncomment the lines below if you want to insert sample data for testing

/*
-- Sample casino game session
INSERT INTO `casino_game_sessions` (
  `user_id`, 
  `member_account`, 
  `game_uid`, 
  `session_token`, 
  `game_launch_url`, 
  `credit_amount`, 
  `currency_code`, 
  `language`, 
  `platform`, 
  `ip_address`
) VALUES (
  1, 
  'test_player', 
  'slot_000001', 
  'session_token_12345', 
  'https://casino.example.com/game/launch?token=12345', 
  1000.00, 
  'INR', 
  'en', 
  'web', 
  '192.168.1.100'
);

-- Sample casino transaction
INSERT INTO `casino_transactions` (
  `session_id`,
  `user_id`, 
  `serial_number`, 
  `member_account`, 
  `game_uid`, 
  `transaction_type`, 
  `bet_amount`, 
  `currency_code`, 
  `timestamp`, 
  `game_round`, 
  `wallet_balance_before`, 
  `wallet_balance_after`, 
  `status`
) VALUES (
  1,
  1, 
  'TXN_12345_BET', 
  'test_player', 
  'slot_000001', 
  'bet', 
  100.00, 
  'INR', 
  UNIX_TIMESTAMP() * 1000, 
  'ROUND_12345', 
  1000.00, 
  900.00, 
  'completed'
);
*/

-- =====================================================
-- Verification Queries
-- =====================================================

-- Run these queries to verify the tables were created successfully

-- Check casino_game_sessions table structure
-- DESCRIBE casino_game_sessions;

-- Check casino_transactions table structure  
-- DESCRIBE casino_transactions;

-- Check foreign key constraints
-- SELECT 
--   TABLE_NAME, 
--   COLUMN_NAME, 
--   CONSTRAINT_NAME, 
--   REFERENCED_TABLE_NAME, 
--   REFERENCED_COLUMN_NAME 
-- FROM 
--   INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
-- WHERE 
--   REFERENCED_TABLE_SCHEMA = DATABASE() 
--   AND TABLE_NAME IN ('casino_game_sessions', 'casino_transactions');

-- =====================================================
-- END OF SCRIPT
-- =====================================================
