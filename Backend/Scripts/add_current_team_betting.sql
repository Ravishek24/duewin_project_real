-- SQL Command to add current_team_betting column to rebet_team_table
-- Run this command in your MySQL database

ALTER TABLE rebet_team_table 
ADD COLUMN current_team_betting DECIMAL(15, 2) NOT NULL DEFAULT 0.00 
COMMENT 'Total daily betting amount by team members';

-- Add index for performance
CREATE INDEX idx_current_team_betting ON rebet_team_table(current_team_betting);

-- Verify the column was added
DESCRIBE rebet_team_table; 