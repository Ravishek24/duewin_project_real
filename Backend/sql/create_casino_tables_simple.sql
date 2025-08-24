-- Simple Casino Tables Creation for MySQL
-- Run these commands in your MySQL database

-- 1. Casino Game Sessions Table
CREATE TABLE `casino_game_sessions` (
  `session_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `member_account` varchar(50) NOT NULL,
  `game_uid` varchar(50) NOT NULL,
  `session_token` varchar(255) DEFAULT NULL,
  `game_launch_url` text NOT NULL,
  `credit_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `currency_code` varchar(3) NOT NULL DEFAULT 'USD',
  `language` varchar(5) NOT NULL DEFAULT 'en',
  `platform` varchar(10) NOT NULL DEFAULT 'web',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `ip_address` varchar(45) DEFAULT NULL,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` datetime DEFAULT NULL,
  `last_activity` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  KEY `user_id` (`user_id`),
  KEY `member_account` (`member_account`),
  KEY `is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Casino Transactions Table
CREATE TABLE `casino_transactions` (
  `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `serial_number` varchar(100) NOT NULL,
  `member_account` varchar(50) NOT NULL,
  `game_uid` varchar(50) NOT NULL,
  `transaction_type` enum('bet','win','balance','rollback') NOT NULL,
  `bet_amount` decimal(15,2) DEFAULT '0.00',
  `win_amount` decimal(15,2) DEFAULT '0.00',
  `currency_code` varchar(3) NOT NULL DEFAULT 'USD',
  `timestamp` bigint(20) NOT NULL,
  `game_round` varchar(100) DEFAULT NULL,
  `data` json DEFAULT NULL,
  `wallet_balance_before` decimal(15,2) DEFAULT NULL,
  `wallet_balance_after` decimal(15,2) DEFAULT NULL,
  `status` enum('pending','completed','failed','rolled_back') NOT NULL DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`transaction_id`),
  UNIQUE KEY `serial_number` (`serial_number`),
  KEY `user_id` (`user_id`),
  KEY `session_id` (`session_id`),
  KEY `transaction_type` (`transaction_type`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
