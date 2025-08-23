# 🚨 Database Lock Debugging Guide

## Overview
This guide helps you diagnose and resolve database lock contention issues that are causing the "Individual credit operation timeout" errors in your credit service.

## 🔍 **New Admin Routes Added**

### 1. **Database Lock Monitoring**
```
GET /admin/database-locks
```
**Purpose**: Shows current database locks, long-running transactions, and credit service queue status.

**Response**:
```json
{
  "success": true,
  "locks": {
    "longRunningTransactions": [...],
    "longRunningQueries": [...],
    "timestamp": "..."
  },
  "queue": {
    "queueSize": 0,
    "activeOperationsSize": 0,
    "connectionPool": {...},
    "timeouts": {...}
  }
}
```

### 2. **Emergency Database Cleanup**
```
POST /admin/emergency-cleanup
```
**Purpose**: Analyzes and reports on database lock contention issues.

### 3. **Credit Service Status**
```
GET /admin/credit-service-status
```
**Purpose**: Shows detailed credit service queue and connection pool status.

### 4. **Force Cleanup**
```
POST /admin/credit-service/force-cleanup
```
**Purpose**: Manually cleans up stuck operations and stale processing statuses.

## 🛠️ **Debugging Tools**

### **1. Database Lock Debug Script**
```bash
node debug-database-locks.js
```
This script directly queries your database to find:
- Long-running transactions
- Current lock waits
- Connection pool status
- MySQL lock timeout settings

### **2. Admin Route Testing**
```bash
node test-admin-routes.js
```
Tests all new admin endpoints (requires admin JWT token).

## 🔧 **How to Use These Tools**

### **Step 1: Immediate Diagnosis**
When you see timeout errors:
```bash
# Run the debug script
node debug-database-locks.js

# Check admin panel for queue status
GET /admin/credit-service-status
```

### **Step 2: Identify the Problem**
Look for:
- **Long-running transactions** (>5 seconds)
- **Lock waits** between transactions
- **High connection pool wait queue** (>5 waiting)
- **Stuck credit service operations**

### **Step 3: Emergency Response**
If you find stuck operations:
```bash
# Force cleanup
POST /admin/credit-service/force-cleanup

# Emergency database cleanup
POST /admin/emergency-cleanup
```

### **Step 4: Monitor Recovery**
```bash
# Check if cleanup worked
GET /admin/credit-service-status

# Monitor for new issues
GET /admin/database-locks
```

## 🚨 **Common Lock Scenarios & Solutions**

### **Scenario 1: Multiple Credit Operations for Same User**
**Symptoms**: 
- `Individual credit operation timeout for user X`
- Multiple processes trying to update same user's balance

**Solution**:
- The enhanced credit service now uses explicit row locking
- Increased timeouts to 60 seconds (longer than MySQL's 50s)
- Better retry logic with exponential backoff

### **Scenario 2: Connection Pool Exhaustion**
**Symptoms**:
- High wait queue in connection pool
- Slow database operations

**Solution**:
- Monitor connection pool status
- Check for connection leaks
- Use emergency cleanup if needed

### **Scenario 3: Long-Running Queries**
**Symptoms**:
- Queries taking >10 seconds
- Database locks held for extended periods

**Solution**:
- Identify problematic queries
- Check for missing indexes
- Consider query optimization

## 📊 **Monitoring Dashboard**

### **Key Metrics to Watch**
1. **Queue Size**: Should be 0 or very low
2. **Active Operations**: Should not be stuck for >5 minutes
3. **Connection Pool Wait Queue**: Should be <5
4. **Long-running Transactions**: Should be 0

### **Alert Thresholds**
- Queue size > 10
- Active operations > 5 minutes old
- Connection pool wait > 10
- Long-running transactions > 30 seconds

## 🚀 **Proactive Prevention**

### **Daily Monitoring**
```bash
# Check credit service health
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3000/admin/credit-service-status

# Check database locks
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3000/admin/database-locks
```

### **Weekly Maintenance**
```bash
# Emergency cleanup to prevent buildup
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3000/admin/emergency-cleanup
```

## 🔍 **Troubleshooting Steps**

### **If Timeouts Persist**
1. **Check database locks**: `GET /admin/database-locks`
2. **Verify queue status**: `GET /admin/credit-service-status`
3. **Run emergency cleanup**: `POST /admin/emergency-cleanup`
4. **Force cleanup**: `POST /admin/credit-service/force-cleanup`
5. **Monitor recovery**: Check endpoints every 30 seconds

### **If Cleanup Doesn't Work**
1. **Check MySQL process list**:
   ```sql
   SHOW PROCESSLIST;
   ```
2. **Kill long-running queries**:
   ```sql
   KILL [process_id];
   ```
3. **Restart credit service** (if necessary)

## 📝 **Log Analysis**

### **Key Log Patterns**
```
⏰ [CREDIT_SERVICE] Individual operation timeout for user X
🔒 [LOCK_ERROR] Database lock issue on attempt X for user Y
🔌 [CONNECTION_ERROR] Connection issue on attempt X for user Y
🚨 [CONNECTION_POOL] High wait queue: X waiting
```

### **What Each Pattern Means**
- **Timeout**: Operation took too long (check for locks)
- **Lock Error**: Database contention (use emergency cleanup)
- **Connection Error**: Pool exhaustion (check connection limits)
- **High Wait Queue**: Too many concurrent operations

## 🎯 **Quick Fix Commands**

### **Immediate Relief**
```bash
# 1. Check what's stuck
GET /admin/database-locks

# 2. Force cleanup
POST /admin/credit-service/force-cleanup

# 3. Emergency cleanup
POST /admin/emergency-cleanup

# 4. Verify recovery
GET /admin/credit-service-status
```

### **Long-term Monitoring**
```bash
# Set up cron job to check every 5 minutes
*/5 * * * * curl -s http://localhost:3000/admin/credit-service-status | grep -q '"queueSize":0' || echo "Credit service queue not empty"
```

## 🚀 **Next Steps**

1. **Test the new routes** with your admin panel
2. **Run the debug script** to see current status
3. **Monitor during next timeout** to catch it early
4. **Use emergency cleanup** when needed
5. **Set up proactive monitoring** to prevent future issues

The enhanced credit service should now handle lock contention much better, but these tools give you visibility and control when issues do occur!
