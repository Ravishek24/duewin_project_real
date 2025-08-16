# WebSocket Rate Limiting Configuration

## 🔌 Updated WebSocket Rate Limits

### **Connection Limits**
- **Per User**: 20 WebSocket connections per hour
- **Per IP**: 5 WebSocket connections per hour

### **Operation Limits**
- **Per User**: 10 WebSocket operations per minute
- **Per IP**: 100 operations per minute
- **Message Rate**: 5 messages per second per user

---

## 📊 Configuration Details

### **Security Config (`config/securityConfig.js`)**
```javascript
rateLimits: {
    user: {
        points: 10, // WebSocket operations: 10 per minute
        duration: 60, // per minute
        burst: 2
    },
    connection: {
        maxPerUser: 20, // WebSocket connections: 20 per user per hour
        maxPerIP: 5
    }
}
```

### **Rate Limiter Service (`services/rateLimiterService.js`)**
```javascript
// Connection tracking
async checkConnectionLimit(socket) {
    const userConnectionsKey = `connections:user:${socket.user.id}`;
    const ipConnectionsKey = `connections:ip:${socket.handshake.address}`;
    
    // Tracks connections per hour
    await redis.expire(userConnectionsKey, 3600); // 1 hour
}

// WebSocket operations tracking
async checkWebSocketOperationLimit(socket) {
    const operationKey = `websocket:operations:${socket.user.id}`;
    return this.checkRateLimit(operationKey, 'user', socket); // 10 per minute
}
```

---

## 🎯 WebSocket Operations Covered

### **Connection Operations**
- WebSocket connection establishment
- Room joining/leaving
- Connection health checks

### **Game Operations**
- Bet placement (`placeBet`)
- Game joining (`joinGame`)
- Game leaving (`leaveGame`)
- Balance checks (`getBalance`)
- Bet history (`getMyBets`)

### **Real-Time Operations**
- Period updates
- Countdown broadcasts
- Game result broadcasts
- Total bets updates

---

## 🛡️ Implementation

### **Connection Rate Limiting**
```javascript
// Applied during WebSocket connection
io.use(async (socket, next) => {
    try {
        await rateLimiterService.checkConnectionLimit(socket);
        next();
    } catch (error) {
        next(new Error('Connection limit exceeded'));
    }
});
```

### **Operation Rate Limiting**
```javascript
// Applied to WebSocket events
socket.on('placeBet', async (betData) => {
    try {
        await rateLimiterService.checkWebSocketOperationLimit(socket);
        // Process bet...
    } catch (error) {
        socket.emit('rateLimitExceeded', {
            message: 'Too many operations',
            retryAfter: 60 // seconds
        });
    }
});
```

---

## 📈 Benefits

✅ **Scalability**: Supports 20 connections per user per hour  
✅ **Performance**: 10 operations per minute prevents abuse  
✅ **Security**: Prevents WebSocket flooding attacks  
✅ **Fair Usage**: Ensures equal access for all users  
✅ **Monitoring**: Redis-based tracking for analytics  

---

## 🔧 Current Status

- **✅ Configuration Updated**: New limits applied
- **✅ Bypass Active**: Rate limiting bypassed for testing
- **✅ Ready for Production**: Can be enabled by removing bypass middleware

---

## 🚀 Usage Examples

### **Client Connection**
```javascript
// Frontend WebSocket connection
const socket = io('ws://your-server.com', {
    auth: {
        token: userJWTToken
    }
});

// Connection will be rate limited to 20 per hour per user
```

### **Bet Placement**
```javascript
// Place bet (rate limited to 10 per minute per user)
socket.emit('placeBet', {
    gameType: 'wingo',
    duration: 60,
    betType: 'color',
    betValue: 'red',
    betAmount: 100
});
```

### **Error Handling**
```javascript
socket.on('rateLimitExceeded', (data) => {
    console.log('Rate limit exceeded:', data.message);
    // Show user-friendly message
    showNotification('Too many requests. Please wait before trying again.');
});
``` 