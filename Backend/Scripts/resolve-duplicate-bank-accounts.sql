-- Script to resolve duplicate bank account numbers
-- Run this before adding the unique constraint

-- 1. First, let's see the details of the duplicate account numbers
SELECT 
    ba.id,
    ba.user_id,
    ba.account_number,
    ba.account_holder_name,
    ba.bank_name,
    ba.ifsc_code,
    ba.is_primary,
    ba.created_at,
    u.user_name,
    u.phone_no
FROM bank_accounts ba
JOIN users u ON ba.user_id = u.user_id
WHERE ba.account_number = '1311921268'
ORDER BY ba.created_at;

-- 2. Check which user should keep this account number
-- (usually the one who created it first or the one who is actively using it)

-- 3. For the duplicate entry, you have two options:

-- OPTION A: Update the duplicate to a different account number
-- UPDATE bank_accounts 
-- SET account_number = CONCAT(account_number, '_', id)
-- WHERE id = [DUPLICATE_ACCOUNT_ID];

-- OPTION B: Delete the duplicate entry (if it's not being used)
-- DELETE FROM bank_accounts WHERE id = [DUPLICATE_ACCOUNT_ID];

-- 4. After resolving duplicates, verify no more duplicates exist
SELECT account_number, COUNT(*) as count
FROM bank_accounts 
WHERE account_number IS NOT NULL 
GROUP BY account_number 
HAVING COUNT(*) > 1;

-- 5. If no duplicates found, you can run the migration to add unique constraint

