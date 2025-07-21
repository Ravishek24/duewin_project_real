# Lock Timeout Issue Fix Guide

## Problem Description

The application was experiencing MySQL lock wait timeout errors (`ER_LOCK_WAIT_TIMEOUT`) when processing withdrawal requests, particularly with the OKPAY payment gateway. The error occurred when trying to update the `wallet_withdrawals` table with transaction IDs.

### Error Details
```
Error: Lock wait timeout exceeded; try restarting transaction
code: 'ER_LOCK_WAIT_TIMEOUT'
errno: 1205
sqlState: 'HY000'
sql: 'UPDATE `wallet_withdrawals` SET `transaction_id`=?,`updated_at`=? WHERE `id` = ?'
```

## Root Cause Analysis

### 1. Nested Transactions
The main issue was **nested transactions** in the withdrawal processing flow:

```javascript
// In processWithdrawalAdminAction
const t = await sequelize.transaction(); // Transaction 1
// ... other operations ...
transferResult = await processOkPayTransfer(withdrawalId, notifyUrl); // Transaction 2 (nested!)
await t.commit();
```

### 2. Concurrent Callback Processing
OKPAY was sending callbacks while the withdrawal was still being processed, creating race conditions:

- Admin approval process starts a transaction
- OKPAY callback arrives and tries to update the same withdrawal record
- Both processes compete for the same database lock
- Lock timeout occurs after the default 50-second wait

### 3. Missing Retry Logic
The original code had no retry mechanism for handling lock timeouts, causing permanent failures.

## Solution Implementation

### 1. Fixed Nested Transaction Issue

**File: `Backend/services/paymentService.js`**

```javascript
// BEFORE (problematic)
const processWithdrawalAdminAction = async (adminId, withdrawalId, action, notes = '', selectedGateway = null) => {
  const t = await sequelize.transaction();
  // ... operations ...
  transferResult = await processOkPayTransfer(withdrawalId, notifyUrl); // Nested transaction!
  await t.commit();
};

// AFTER (fixed)
const processWithdrawalAdminAction = async (adminId, withdrawalId, action, notes = '', selectedGateway = null) => {
  const t = await sequelize.transaction();
  // ... operations ...
  await t.commit(); // Commit first
  
  // Process transfer outside of transaction
  transferResult = await processOkPayTransfer(withdrawalId, notifyUrl);
};
```

### 2. Added Retry Logic with Exponential Backoff

**File: `Backend/services/paymentService.js`**

```javascript
const processOkPayTransfer = async (withdrawalId, notifyUrl) => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    const t = await sequelize.transaction();
    
    try {
      // Get withdrawal with lock to prevent concurrent updates
      const withdrawal = await WalletWithdrawal.findByPk(withdrawalId, {
        lock: true, // Add explicit locking
        transaction: t
      });
      
      // ... rest of the logic ...
      
    } catch (error) {
      await t.rollback();
      
      // Check if error is a lock timeout
      if (error.name === 'SequelizeDatabaseError' && 
          error.parent && 
          error.parent.code === 'ER_LOCK_WAIT_TIMEOUT') {
        
        retryCount++;
        console.warn(`Lock timeout detected for withdrawal ${withdrawalId}, retrying (${retryCount}/${maxRetries})`);
        
        if (retryCount < maxRetries) {
          // Wait for a random time between 100-500ms before retrying
          const delay = 100 + Math.floor(Math.random() * 400);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      throw error;
    }
  }
};
```

### 3. Enhanced Callback Processing

**File: `Backend/services/paymentService.js`**

```javascript
const processPayOutCallback = async (callbackData) => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    const t = await sequelize.transaction();
    
    try {
      // Find the withdrawal record with lock to prevent concurrent updates
      const withdrawalRecord = await WalletWithdrawal.findOne({
        where: { transaction_id: out_trade_no },
        lock: true, // Add explicit locking
        transaction: t
      });
      
      // ... rest of the logic ...
      
    } catch (error) {
      await t.rollback();
      
      // Check if error is a lock timeout
      if (error.name === 'SequelizeDatabaseError' && 
          error.parent && 
          error.parent.code === 'ER_LOCK_WAIT_TIMEOUT') {
        
        retryCount++;
        console.warn(`Lock timeout detected for withdrawal callback ${out_trade_no}, retrying (${retryCount}/${maxRetries})`);
        
        if (retryCount < maxRetries) {
          const delay = 100 + Math.floor(Math.random() * 400);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      throw error;
    }
  }
};
```

### 4. Created Database Utility Functions

**File: `Backend/utils/databaseUtils.js`**

Created reusable utility functions for handling database operations with retry logic:

- `executeWithRetry()` - Generic retry logic for database operations
- `executeWithOptimisticLock()` - For optimistic locking scenarios
- `executeWithPessimisticLock()` - For pessimistic locking scenarios
- `executeWithDistributedLock()` - For distributed locking using Redis
- `isLockTimeoutError()` - Utility to check if an error is a lock timeout
- `calculateRetryDelay()` - Exponential backoff with jitter

### 5. Created Monitoring and Fix Script

**File: `Backend/scripts/fix-lock-timeout-issues.js`**

Created a comprehensive script to:

- Monitor active database locks
- Check for long-running transactions
- Identify stuck withdrawal records
- Automatically fix issues (with `--auto-fix` flag)
- Provide database performance metrics

## Usage Instructions

### 1. Monitor Lock Issues

```bash
cd Backend
node scripts/fix-lock-timeout-issues.js
```

### 2. Auto-fix Issues

```bash
cd Backend
node scripts/fix-lock-timeout-issues.js --auto-fix
```

### 3. Use Database Utilities

```javascript
const { executeWithRetry, executeWithPessimisticLock } = require('./utils/databaseUtils');

// Example usage
const result = await executeWithPessimisticLock(async (transaction) => {
  const withdrawal = await WalletWithdrawal.findByPk(withdrawalId, {
    lock: true,
    transaction
  });
  
  await withdrawal.update({
    status: 'completed',
    transaction_id: transactionId
  }, { transaction });
  
  return withdrawal;
});
```

## Best Practices

### 1. Transaction Management
- Avoid nested transactions
- Keep transactions as short as possible
- Use explicit locking when needed
- Always handle rollback in catch blocks

### 2. Retry Logic
- Use exponential backoff with jitter
- Limit maximum retry attempts
- Log retry attempts for monitoring
- Handle different types of errors appropriately

### 3. Locking Strategy
- Use `lock: true` for critical operations
- Consider using `FOR UPDATE SKIP LOCKED` for high concurrency
- Implement distributed locking for multi-instance deployments

### 4. Monitoring
- Monitor lock wait times
- Track long-running transactions
- Set up alerts for lock timeout errors
- Regular health checks with the monitoring script

## Configuration Recommendations

### 1. MySQL Configuration

```sql
-- Increase lock wait timeout (default is 50 seconds)
SET GLOBAL innodb_lock_wait_timeout = 120;

-- Optimize for better concurrency
SET GLOBAL innodb_deadlock_detect = ON;
SET GLOBAL innodb_print_all_deadlocks = ON;
```

### 2. Application Configuration

```javascript
// In your database config
const config = {
  pool: {
    max: 20,
    min: 5,
    acquire: 60000,
    idle: 10000
  },
  dialectOptions: {
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000
  }
};
```

## Testing

### 1. Load Testing
Test the fix with concurrent withdrawal requests:

```bash
# Run load test
cd Backend/load-test
node test-concurrent-withdrawals.js
```

### 2. Monitoring During Tests
```bash
# Monitor locks during testing
node scripts/fix-lock-timeout-issues.js
```

## Troubleshooting

### 1. Still Getting Lock Timeouts?
- Check for other long-running transactions
- Verify no other processes are holding locks
- Increase MySQL lock wait timeout temporarily
- Use the monitoring script to identify issues

### 2. Performance Issues?
- Review transaction isolation levels
- Consider using optimistic locking for read-heavy operations
- Implement connection pooling
- Monitor database performance metrics

### 3. Callback Issues?
- Verify callback URLs are correct
- Check signature verification
- Ensure proper error handling in callbacks
- Monitor callback processing logs

## Conclusion

The implemented solution addresses the root causes of lock timeout issues:

1. ✅ **Fixed nested transactions** by committing before calling external services
2. ✅ **Added retry logic** with exponential backoff and jitter
3. ✅ **Enhanced locking** with explicit row-level locks
4. ✅ **Created monitoring tools** for proactive issue detection
5. ✅ **Implemented utility functions** for consistent error handling

This comprehensive approach should eliminate lock timeout errors and improve the overall reliability of the withdrawal processing system. 