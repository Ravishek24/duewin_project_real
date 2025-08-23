-- Backend/update-transaction-precision.sql
-- Update Transaction table to support 5 decimal places for precise rebate amounts

-- Check current column definitions
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    NUMERIC_PRECISION, 
    NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'transactions'
AND COLUMN_NAME IN ('amount', 'previous_balance', 'new_balance')
ORDER BY COLUMN_NAME;

-- Update amount column to support 5 decimal places
ALTER TABLE transactions 
MODIFY COLUMN amount DECIMAL(15,5) NOT NULL COMMENT 'Transaction amount with 5 decimal precision';

-- Update previous_balance column to support 5 decimal places
ALTER TABLE transactions 
MODIFY COLUMN previous_balance DECIMAL(15,5) NULL COMMENT 'User balance before transaction with 5 decimal precision';

-- Update new_balance column to support 5 decimal places
ALTER TABLE transactions 
MODIFY COLUMN new_balance DECIMAL(15,5) NULL COMMENT 'User balance after transaction with 5 decimal precision';

-- Verify the changes
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    NUMERIC_PRECISION, 
    NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'transactions'
AND COLUMN_NAME IN ('amount', 'previous_balance', 'new_balance')
ORDER BY COLUMN_NAME;

-- Test inserting a small amount
INSERT INTO transactions (
    user_id, 
    type, 
    amount, 
    status, 
    description, 
    reference_id
) VALUES (
    999, 
    'test', 
    0.00001, 
    'completed', 
    'Test precision', 
    'test_precision_001'
);

-- Check if the test record was inserted correctly
SELECT 
    id, 
    user_id, 
    type, 
    amount, 
    created_at
FROM transactions 
WHERE reference_id = 'test_precision_001';

-- Clean up test record
DELETE FROM transactions WHERE reference_id = 'test_precision_001';

SELECT 'Transaction table precision update completed successfully!' as status;
