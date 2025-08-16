# Credit Service Deadlock Fix Summary

## Problem Analysis

The application was experiencing **MySQL Lock Wait Timeout** errors in the credit transaction system:

```
Error adding credit: Error
  name: 'SequelizeDatabaseError',
  parent: Error: Lock wait timeout exceeded; try restarting transaction
  code: 'ER_LOCK_WAIT_TIMEOUT',
  errno: 1205
```

## Root Cause

The deadlock was caused by:

1. **Multiple concurrent credit transactions** for the same user
2. **Simultaneous database operations** on `credit_transactions` and `credit_summaries` tables
3. **Race conditions** when updating user wallet balances
4. **Lock contention** during payment callback processing

## What Was Happening

The error occurred in this flow:
```
okPayCallbackController → processOkPayCallback → processFirstRechargeBonus → CreditService.addCredit → Database INSERT
```

**Problem**: Multiple payment callbacks or bonus processes were trying to add credits to the same user simultaneously, causing database lock conflicts.

## Solution Implemented

### 1. **Queue System** - Prevents Concurrent Processing
- Each user gets their own credit processing queue
- Credit transactions are processed sequentially per user
- Eliminates race conditions and lock contention

### 2. **Retry Logic** - Handles Occasional Deadlocks
- Automatic retry up to 3 times for deadlock errors
- Exponential backoff delay (100ms, 200ms, 400ms)
- Graceful fallback if all retries fail

### 3. **Enhanced Error Handling**
- Specific detection of `ER_LOCK_WAIT_TIMEOUT` errors
- Detailed logging for debugging and monitoring
- Proper error propagation to calling functions

## Code Changes

### 1. **Queue Implementation**
```javascript
// Queue to prevent concurrent credit transactions for the same user
const userCreditQueue = new Map();

// Process queue for a specific user
const processUserCreditQueue = async (userId) => {
    const queue = getUserCreditQueue(userId);
    
    while (queue.length > 0) {
        const { resolve, reject, params } = queue.shift();
        
        try {
            const result = await addCreditInternal(...params);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }
};
```

### 2. **Retry Configuration**
```javascript
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 100, // 100ms
    maxDelay: 2000, // 2 seconds
    backoffMultiplier: 2
};
```

### 3. **Deadlock Detection and Retry**
```javascript
// Check if it's a deadlock error
if (error.code === 'ER_LOCK_WAIT_TIMEOUT' || 
    error.message.includes('Lock wait timeout exceeded')) {
    
    console.log(`⚠️ [CREDIT_SERVICE] Deadlock detected on attempt ${attempt}, retrying...`);
    
    if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = calculateRetryDelay(attempt);
        console.log(`⏳ [CREDIT_SERVICE] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
    }
}
```

## Benefits

### 1. **Eliminates Deadlocks**
- Queue system prevents concurrent database operations
- Sequential processing eliminates lock contention
- Each user's transactions are isolated

### 2. **Improves Reliability**
- Automatic retry for occasional deadlocks
- Graceful degradation if retries fail
- Better error handling and logging

### 3. **Maintains Performance**
- Queue processing is asynchronous
- Minimal overhead for single-user scenarios
- Scales well with multiple users

## Usage

### 1. **Basic Credit Addition**
```javascript
// The queue system is transparent to calling code
const result = await CreditService.addCredit(
    userId, 
    amount, 
    'welcome_bonus', 
    'external', 
    referenceId, 
    description
);
```

### 2. **With Transaction**
```javascript
// For operations that need to be part of a larger transaction
const result = await CreditService.addCreditWithTransaction(
    userId, 
    amount, 
    'referral_bonus', 
    'system', 
    referenceId, 
    description, 
    transaction
);
```

## Monitoring and Debugging

### 1. **Queue Status**
```javascript
// Check queue status for a user
const queue = userCreditQueue.get(userId);
console.log(`User ${userId} has ${queue.length} pending credit operations`);
```

### 2. **Retry Attempts**
```bash
# Monitor retry attempts in logs
grep "Deadlock detected on attempt" /home/ubuntu/.pm2/logs/strike-backend-error.log

# Check successful credit additions
grep "Credit added successfully" /home/ubuntu/.pm2/logs/strike-backend-error.log
```

### 3. **Database Monitoring**
```sql
-- Check for long-running transactions
SELECT * FROM information_schema.INNODB_TRX 
WHERE trx_started < NOW() - INTERVAL 30 SECOND;

-- Check for lock waits
SELECT * FROM information_schema.INNODB_LOCK_WAITS;
```

## Prevention

### 1. **Code Review Checklist**
- [ ] All credit operations use the queue system
- [ ] Proper error handling for deadlock scenarios
- [ ] Consistent use of transaction objects when needed
- [ ] Logging for debugging and monitoring

### 2. **Testing**
- Test concurrent credit operations for the same user
- Verify queue processing works correctly
- Test retry logic with simulated deadlocks

### 3. **Monitoring**
- Monitor queue lengths for high-traffic users
- Track retry attempts and success rates
- Alert on repeated deadlock failures

## Common Scenarios

### 1. **First Deposit Bonus**
- User makes first deposit
- System processes payment callback
- Bonus credit is added through queue system
- No conflicts with other operations

### 2. **Referral Bonuses**
- Multiple referrals processed simultaneously
- Each referral bonus queued separately
- Sequential processing prevents deadlocks

### 3. **Promotional Credits**
- Admin adds promotional credits
- System processes through queue
- No interference with user-initiated operations

## Support

For additional help:
1. Check credit service logs for queue processing
2. Monitor database lock wait timeouts
3. Verify queue system is working correctly
4. Test individual credit operations

---

**Note**: This fix ensures that all credit transactions are processed sequentially per user, preventing deadlocks while maintaining system performance and reliability.
