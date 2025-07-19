# Multi-Instance Setup Guide

## Overview

Your backend is configured as a multi-instance setup where:
- **Scheduler Instance**: Runs `start-scheduler.js` and manages game periods
- **WebSocket Instance**: Runs `index.js` and handles real-time communication with clients

Both instances communicate through Redis pub/sub to share period data and events.

## Current Issues

Based on your logs, the main issues are:
1. **No valid period data found** - WebSocket can't find period information
2. **Period requests not being fulfilled** - Scheduler not responding to WebSocket requests
3. **Redis connection limits** - Too many Redis connections causing "max clients reached"

## Solution Steps

### Step 1: Fix Redis Connection Issues

First, run the Redis connection fix script:

```bash
cd Backend
node fix-redis-connection-issues.js
```

This will:
- Clear stale Redis connections
- Test connection pooling
- Provide recommendations

### Step 2: Test Multi-Instance Communication

Run the multi-instance communication test:

```bash
cd Backend
node fix-multi-instance.js
```

This will:
- Create test periods in Redis
- Test pub/sub communication
- Verify both instances can communicate

### Step 3: Start Instances in Correct Order

#### Server 1 (Scheduler Instance):
```bash
cd Backend
node start-scheduler.js
```

**Expected Logs:**
```
✅ SCHEDULER: Game scheduler started successfully with MULTI-INSTANCE SUPPORT
📢 SCHEDULER: Broadcasted new period start: [period_id]
📤 [PERIOD_START] Broadcasting period start: [period_id]
```

#### Server 2 (WebSocket Instance):
```bash
cd Backend
node index.js
```

**Expected Logs:**
```
✅ [REDIS_SUBSCRIBER] Multi-instance subscriber created and connected
✅ [REDIS_PUBSUB] Redis subscriptions setup completed
📢 [WEBSOCKET_PASSIVE] Received period start for [room_id]: [period_id]
```

### Step 4: Verify Communication

Check these indicators:

1. **Scheduler Logs** should show:
   - Period creation and broadcasting
   - Redis publishing to channels
   - No "max clients reached" errors

2. **WebSocket Logs** should show:
   - Redis subscription success
   - Period data retrieval
   - Client broadcasting

3. **Redis Keys** should exist:
   ```bash
   redis-cli
   KEYS game_scheduler:*:*:current
   GET game_scheduler:wingo:30:current
   ```

## Configuration Files Updated

### 1. `config/redis.js` - Enhanced with Singleton Pattern
- Prevents multiple Redis connections
- Implements connection pooling
- Adds graceful shutdown

### 2. `config/redisConfig.js` - Enhanced for Multi-Instance
- Singleton pattern for node-redis
- Connection pooling settings
- Enhanced error handling

### 3. `services/websocketService.js` - Multi-Instance Ready
- Redis pub/sub for scheduler communication
- Period caching for performance
- Fallback period retrieval mechanisms
- Enhanced error handling

### 4. `scripts/gameScheduler.js` - Multi-Instance Broadcasting
- Enhanced period broadcasting
- Multiple Redis channels for reliability
- Scheduler heartbeat system
- Cross-instance communication

## Troubleshooting

### Issue: "No valid period data found"

**Causes:**
- Scheduler not running
- Redis connection issues
- Period data not being created
- Key pattern mismatch

**Solutions:**
1. Ensure scheduler is running on Server 1
2. Check Redis connectivity
3. Verify period creation in scheduler logs
4. Run `fix-multi-instance.js` to create test periods

### Issue: "max number of clients reached"

**Causes:**
- Multiple Redis connections
- Connection leaks
- No connection pooling

**Solutions:**
1. Run `fix-redis-connection-issues.js`
2. Restart both instances
3. Check for connection leaks in code
4. Monitor Redis connection count

### Issue: WebSocket not receiving events

**Causes:**
- Redis pub/sub not working
- Channel subscription issues
- Network connectivity problems

**Solutions:**
1. Test pub/sub with `fix-multi-instance.js`
2. Check Redis configuration
3. Verify network connectivity
4. Check firewall settings

## Monitoring Commands

### Check Redis Connections:
```bash
redis-cli
CLIENT LIST
```

### Check Period Data:
```bash
redis-cli
KEYS game_scheduler:*:*:current
```

### Check Pub/Sub:
```bash
redis-cli
PUBSUB CHANNELS
```

### Monitor Redis Activity:
```bash
redis-cli
MONITOR
```

## Environment Variables

Ensure both instances have the same Redis configuration:

```env
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
```

## Performance Optimization

1. **Connection Pooling**: Both Redis configs now use connection pooling
2. **Period Caching**: WebSocket caches period data for 30 seconds
3. **Fallback Mechanisms**: Multiple Redis key patterns for reliability
4. **Error Handling**: Enhanced error handling and retry logic

## Security Considerations

1. **Redis TLS**: Both configs use TLS for encryption
2. **Connection Limits**: Implemented to prevent connection exhaustion
3. **Authentication**: Redis password authentication
4. **Network Security**: Ensure Redis is not exposed publicly

## Next Steps

1. Run the fix scripts
2. Start instances in correct order
3. Monitor logs for communication
4. Test with real clients
5. Set up monitoring and alerts

## Support

If issues persist:
1. Check Redis server logs
2. Monitor network connectivity
3. Verify Redis configuration
4. Check for firewall issues
5. Review application logs for errors 