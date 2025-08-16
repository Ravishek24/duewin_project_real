# Deadlock Fix Implementation Summary

## Problem Analysis

The application was experiencing **MySQL Lock Wait Timeout** errors (`ER_LOCK_WAIT_TIMEOUT`) caused by:

1. **Concurrent rebate processing** - Multiple bets triggering rebates for the same user simultaneously
2. **Nested transactions** - `processSelfRebate` creating transactions while `CreditService.addCredit` also tried to create database operations
3. **Race conditions** - Multiple processes updating the same user records at the same time
4. **Lock contention** - Database locks being held too long during wallet balance updates

## Root Cause

The deadlock occurred in this flow:
```
gameLogicService.js (line 9464) 
  → processSelfRebate() 
    → CreditService.addCredit() 
      → Creates new database operations
    → User.increment() 
      → Updates wallet_balance
```

When multiple bets were processed simultaneously, they would:
1. Lock the same user record
2. Wait for each other to release locks
3. Eventually timeout after 50 seconds (default MySQL setting)

## Solution Implemented

### 1. Queue-Based Processing (`selfRebateService.js`)

- **User-specific queues** prevent concurrent processing of rebates for the same user
- **Sequential execution** ensures only one rebate process runs per user at a time
- **Automatic cleanup** removes empty queues to prevent memory leaks

```javascript
const userRebateQueue = new Map();

const queueRebateProcessing = async (userId, ...params) => {
    return new Promise((resolve, reject) => {
        const queue = getUserQueue(userId);
        queue.push({ resolve, reject, params });
        
        if (queue.length === 1) {
            processUserQueue(userId);
        }
    });
};
```

### 2. Retry Logic with Exponential Backoff

- **Automatic retry** on deadlock detection (up to 3 attempts)
- **Exponential backoff** delays between retries (100ms, 200ms, 400ms)
- **Smart error detection** identifies deadlock vs. other errors

```javascript
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 100, // ms
    maxDelay: 2000, // ms
    backoffMultiplier: 2
};
```

### 3. Transaction Optimization

- **Single transaction** per rebate process (no nested transactions)
- **Proper isolation level** (`READ_COMMITTED`) reduces lock contention
- **Row-level locking** (`FOR UPDATE`) prevents race conditions

```javascript
const t = transaction || await sequelize.transaction({
    isolationLevel: sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
});

const user = await User.findByPk(userId, {
    lock: t.LOCK.UPDATE,
    transaction: t
});
```

### 4. Credit Service Integration

- **New method** `addCreditWithTransaction()` accepts existing transactions
- **Prevents nested transactions** that cause deadlocks
- **Maintains data consistency** within single transaction scope

```javascript
await CreditService.addCreditWithTransaction(
    userId, rebateAmount, 'betting_rebate', 'self',
    referenceId, description, t // Pass existing transaction
);
```

## Files Modified

### 1. `Backend/services/selfRebateService.js`
- Added queue system for user-specific processing
- Implemented retry logic with exponential backoff
- Optimized transaction handling
- Added proper error handling and logging

### 2. `Backend/services/creditService.js`
- Added `addCreditWithTransaction()` method
- Added `updateUserCreditSummaryWithTransaction()` method
- Prevents nested transaction creation

### 3. `Backend/config/mysql-deadlock-prevention.sql`
- MySQL configuration optimizations
- Lock timeout adjustments
- InnoDB parameter tuning

### 4. `Backend/scripts/monitor-deadlocks.js`
- Real-time deadlock monitoring
- Process list analysis
- Lock wait detection
- Auto-kill for long-running queries

## Database Optimizations

### MySQL Configuration Changes
```sql
-- Reduce lock wait timeout from 50s to 30s
SET GLOBAL innodb_lock_wait_timeout = 30;

-- Enable deadlock detection
SET GLOBAL innodb_deadlock_detect = ON;

-- Use READ-COMMITTED isolation level
SET GLOBAL transaction_isolation = 'READ-COMMITTED';

-- Optimize InnoDB settings
SET GLOBAL innodb_thread_concurrency = 0;
SET GLOBAL innodb_read_io_threads = 8;
SET GLOBAL innodb_write_io_threads = 8;
```

### Recommended Indexes
```sql
-- Reduce lock contention on frequently accessed columns
CREATE INDEX idx_user_id_status ON credit_transactions(user_id, status);
CREATE INDEX idx_user_id_created ON credit_transactions(user_id, created_at);
CREATE INDEX idx_user_id_game ON credit_transactions(user_id, game_type);
```

## Usage Instructions

### 1. Apply Database Changes
```bash
# Connect to your RDS MySQL instance
mysql -h [your-rds-endpoint] -P 3306 -u [username] -p

# Run the optimization script
source Backend/config/mysql-deadlock-prevention.sql;
```

### 2. Monitor Deadlocks
```bash
# Start monitoring (check every 30 seconds)
node Backend/scripts/monitor-deadlocks.js --interval=30000

# Enable auto-kill for queries > 5 minutes
node Backend/scripts/monitor-deadlocks.js --auto-kill

# Check every 10 seconds
node Backend/scripts/monitor-deadlocks.js --interval=10000
```

### 3. Restart Your Application
```bash
# Restart PM2 processes
pm2 restart all

# Check logs for any remaining issues
pm2 logs
```

## Expected Results

After implementing these fixes:

1. **Deadlocks eliminated** - Queue system prevents concurrent user processing
2. **Faster recovery** - Retry logic handles occasional deadlocks gracefully
3. **Better performance** - Optimized transactions and database settings
4. **Real-time monitoring** - Immediate detection of any remaining issues
5. **Reduced timeouts** - Lock wait timeout reduced from 50s to 30s

## Monitoring and Maintenance

### Daily Checks
- Monitor deadlock statistics
- Check for long-running queries
- Review error logs for any new patterns

### Weekly Maintenance
- Analyze table statistics
- Review and optimize slow queries
- Check database performance metrics

### Monthly Review
- Analyze deadlock patterns
- Review queue performance
- Optimize database configuration

## Troubleshooting

### If Deadlocks Persist
1. Check if multiple instances are running
2. Verify queue system is working
3. Review database connection pooling
4. Check for long-running transactions

### Performance Issues
1. Monitor queue lengths
2. Check database connection count
3. Review transaction isolation levels
4. Analyze query execution plans

## Support

For additional help:
1. Check the monitoring script output
2. Review MySQL error logs
3. Analyze application logs for error patterns
4. Contact database administrator for RDS-specific issues

---

**Note**: This solution addresses the immediate deadlock issues while maintaining data consistency and improving overall system reliability.
