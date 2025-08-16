-- Backend/sql/add_wagering_to_wallet_withdrawal.sql
-- Add wagering system fields to existing wallet_withdrawals table

ALTER TABLE wallet_withdrawals 
ADD COLUMN wagering_status JSON COMMENT 'Wagering verification details at time of withdrawal',
ADD COLUMN wagering_checked BOOLEAN DEFAULT FALSE COMMENT 'Whether wagering requirements were verified';

-- Add index for wagering_checked field for better performance
CREATE INDEX idx_wagering_checked ON wallet_withdrawals(wagering_checked);
