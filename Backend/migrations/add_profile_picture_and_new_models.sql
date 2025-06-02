-- Add profile_picture_id column to users table
ALTER TABLE users
ADD COLUMN profile_picture_id VARCHAR(255) DEFAULT NULL;

-- Create ActivityReward table
CREATE TABLE activity_rewards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    lottery_bet_amount DECIMAL(20,2) DEFAULT 0.00,
    all_games_bet_amount DECIMAL(20,2) DEFAULT 0.00,
    claimed_milestones JSON,
    total_rewards DECIMAL(20,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_user_date (user_id, date)
);

-- Create SelfRebate table
CREATE TABLE self_rebates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    bet_amount DECIMAL(20,2) NOT NULL,
    rebate_rate DECIMAL(5,4) NOT NULL,
    rebate_amount DECIMAL(20,2) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    vip_level VARCHAR(10) NOT NULL,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_user_created (user_id, created_at)
);

-- Create UserVault table
CREATE TABLE user_vaults (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    balance DECIMAL(20,2) DEFAULT 0.00,
    interest_rate DECIMAL(5,4) DEFAULT 0.0000,
    last_interest_date DATE,
    status ENUM('active', 'inactive', 'locked') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE KEY unique_user_vault (user_id)
);

-- Create VaultTransaction table
CREATE TABLE vault_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    vault_id INT NOT NULL,
    type ENUM('deposit', 'withdraw', 'interest') NOT NULL,
    amount DECIMAL(20,2) NOT NULL,
    balance_before DECIMAL(20,2) NOT NULL,
    balance_after DECIMAL(20,2) NOT NULL,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (vault_id) REFERENCES user_vaults(id),
    INDEX idx_user_created (user_id, created_at)
); 