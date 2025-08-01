# 🚀 5D Pre-Calculation System - Load Balancer Deployment Guide

## 📋 **Overview**

This guide explains how to deploy the 5D Independent Pre-Calculation System in a load balancer environment with multiple WebSocket instances.

---

## 🏗️ **Load Balancer Architecture**

### **Production Setup:**
```
Load Balancer (Nginx/HAProxy/AWS ALB)
    ├── WebSocket Instance 1 (Port 3000) - PM2 Instance 0
    ├── WebSocket Instance 2 (Port 3001) - PM2 Instance 1
    ├── WebSocket Instance 3 (Port 3002) - PM2 Instance 2
    └── WebSocket Instance N (Port 300N) - PM2 Instance N

5D Pre-Calculation Scheduler (Port 3001) - Single Instance
    ├── Monitors all 5D periods
    ├── Publishes results via Redis Pub/Sub
    └── All WebSocket instances subscribe to notifications
```

---

## 🔄 **How It Works with Load Balancer**

### **1. Pre-Calculation Flow (Single Scheduler):**
```
5D Pre-Calculation Scheduler (Single Instance)
├── Monitors 5D periods independently
├── Triggers pre-calculation at t=5s (bet freeze)
├── Calculates result with final bet patterns
├── Stores result in Redis (with NX flag to prevent duplicates)
└── Publishes completion notification to all WebSocket instances
```

### **2. Result Delivery Flow (Multiple WebSocket Instances):**
```
At t=0s (Period End):
├── Load Balancer routes requests to any WebSocket instance
├── Each WebSocket instance checks for pre-calculated result
├── All instances retrieve the same result from Redis
├── All instances deliver the same result to their clients
└── Consistent result across all instances
```

### **3. Safety Mechanisms:**
```
Race Condition Prevention:
├── Redis SET with NX flag prevents duplicate calculations
├── Only one scheduler instance can store result per period
├── All WebSocket instances verify result in Redis before using

Data Consistency:
├── All instances subscribe to same Redis Pub/Sub channels
├── Result verification before memory storage
├── Fallback to real-time calculation if pre-calculated result missing
```

---

## 🚀 **Deployment Steps**

### **Step 1: Deploy 5D Pre-Calculation Scheduler**

```bash
# On the scheduler server
cd Backend

# Start the 5D pre-calculation scheduler
chmod +x start-5d-precalc-scheduler.sh
./start-5d-precalc-scheduler.sh

# Verify it's running
pm2 list
pm2 logs 5d-precalc-scheduler
```

### **Step 2: Deploy Multiple WebSocket Instances**

```bash
# On each WebSocket server
cd Backend

# Start multiple WebSocket instances
pm2 start ecosystem.config.js --instances 4

# Or start individual instances
pm2 start ecosystem.config.js --name "websocket-0" --instance-id 0
pm2 start ecosystem.config.js --name "websocket-1" --instance-id 1
pm2 start ecosystem.config.js --name "websocket-2" --instance-id 2
pm2 start ecosystem.config.js --name "websocket-3" --instance-id 3
```

### **Step 3: Configure Load Balancer**

#### **Nginx Configuration:**
```nginx
upstream websocket_backend {
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
    server 192.168.1.12:3000;
    server 192.168.1.13:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location /socket.io/ {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
```

#### **HAProxy Configuration:**
```haproxy
global
    maxconn 4096

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend websocket_frontend
    bind *:80
    default_backend websocket_backend

backend websocket_backend
    balance roundrobin
    server websocket1 192.168.1.10:3000 check
    server websocket2 192.168.1.11:3000 check
    server websocket3 192.168.1.12:3000 check
    server websocket4 192.168.1.13:3000 check
```

### **Step 4: Verify Deployment**

```bash
# Check all processes
pm2 list

# Check scheduler logs
pm2 logs 5d-precalc-scheduler

# Check WebSocket logs
pm2 logs websocket-0
pm2 logs websocket-1
pm2 logs websocket-2
pm2 logs websocket-3

# Run test suite
node test-5d-independent-precalc.js
```

---

## 🔍 **Monitoring and Debugging**

### **Key Log Messages for Load Balancer:**

#### **5D Pre-Calculation Scheduler:**
```
🎯 [5D_PRECALC_EXEC] Starting pre-calculation for period 20250731000000001
📊 [5D_PRECALC_EXEC] Retrieved bet patterns for period 20250731000000001
💾 [5D_PRECALC_EXEC] Result stored in Redis for period 20250731000000001
✅ [5D_PRECALC_EXEC] Pre-calculation completed for period 20250731000000001 in 2710ms
📊 Scheduler: 0@server1, Bet patterns: 15, Total exposure: 25000
```

#### **WebSocket Instances:**
```
🔄 [5D_PRECALC_SUB] Setting up 5D pre-calculation subscription...
✅ [5D_PRECALC_COMPLETED] Pre-calculation completed for fiveD_60_20250731000000001
📊 [5D_PRECALC_COMPLETED] Scheduler: 0@server1, Bet patterns: 15, Total exposure: 25000
💾 [5D_PRECALC_COMPLETED] Result stored for fiveD_60_20250731000000001 by websocket-0
🎯 [5D_PERIOD_END] fiveD_60: Checking for pre-calculated result for period 20250731000000001
✅ [5D_PERIOD_END] fiveD_60: Using pre-calculated result for period 20250731000000001
```

### **Troubleshooting Commands:**

#### **1. Check Scheduler Status:**
```bash
# Check if scheduler is running
pm2 list | grep 5d-precalc-scheduler

# Check scheduler logs
pm2 logs 5d-precalc-scheduler --lines 50

# Check scheduler process info
pm2 show 5d-precalc-scheduler
```

#### **2. Check WebSocket Instances:**
```bash
# Check all WebSocket instances
pm2 list | grep websocket

# Check specific instance logs
pm2 logs websocket-0 --lines 50
pm2 logs websocket-1 --lines 50

# Check instance process info
pm2 show websocket-0
```

#### **3. Check Redis Communication:**
```bash
# Check Redis connectivity
redis-cli ping

# Check pre-calculated results
redis-cli get "precalc_5d_result:fiveD:60:default:20250731000000001"

# Monitor Redis Pub/Sub
redis-cli monitor | grep "5d_precalc"
```

#### **4. Check Load Balancer:**
```bash
# Test load balancer health
curl -I http://your-domain.com/socket.io/

# Check load balancer logs
tail -f /var/log/nginx/access.log
tail -f /var/log/haproxy.log
```

---

## 🛡️ **Safety Features for Load Balancer**

### **1. Race Condition Prevention:**
```javascript
// Only one scheduler can store result per period
const stored = await redis.set(resultKey, data, 'EX', 300, 'NX');
if (!stored) {
    console.log('Result already stored by another instance');
    return;
}
```

### **2. Result Verification:**
```javascript
// WebSocket instances verify result in Redis before using
const redisResult = await getRedisHelper().get(resultKey);
if (!redisResult) {
    console.log('Result not found in Redis, skipping memory storage');
    return false;
}
```

### **3. Instance Tracking:**
```javascript
// Track which instance calculated and received results
const completionMessage = {
    schedulerInstance: process.env.PM2_INSTANCE_ID || 'unknown',
    schedulerHost: require('os').hostname(),
    receivedBy: process.env.PM2_INSTANCE_ID || 'websocket_instance'
};
```

### **4. Fallback Mechanisms:**
```javascript
// If pre-calculated result not available, use real-time calculation
if (preCalcResult) {
    // Use pre-calculated result
} else {
    // Fallback to real-time calculation
    await processGameResults(gameType, duration, periodId, 'default');
}
```

---

## 📊 **Performance Monitoring**

### **Key Metrics to Monitor:**

#### **1. Scheduler Performance:**
- Pre-calculation success rate
- Execution time per period
- Memory usage
- CPU usage

#### **2. WebSocket Performance:**
- Result retrieval time
- Memory usage per instance
- Client connection count per instance
- Response time per instance

#### **3. Redis Performance:**
- Memory usage
- Connection count
- Pub/Sub message delivery
- Storage operations

#### **4. Load Balancer Performance:**
- Request distribution
- Response time
- Error rate
- Connection count

### **Monitoring Commands:**
```bash
# Monitor all processes
pm2 monit

# Check system resources
htop
iotop

# Monitor Redis
redis-cli info memory
redis-cli info stats

# Monitor network
netstat -tulpn | grep :3000
```

---

## 🔧 **Scaling Considerations**

### **1. Horizontal Scaling:**
```bash
# Add more WebSocket instances
pm2 start ecosystem.config.js --instances 8

# Add more scheduler instances (if needed)
pm2 start ecosystem-5d-precalc.config.js --instances 2
```

### **2. Vertical Scaling:**
```bash
# Increase memory limit
pm2 start ecosystem.config.js --max-memory-restart 1G

# Increase CPU priority
pm2 start ecosystem.config.js --node-args "--max-old-space-size=2048"
```

### **3. Geographic Distribution:**
```bash
# Deploy scheduler closer to database
# Deploy WebSocket instances closer to users
# Use Redis Cluster for multi-region
```

---

## ✅ **Success Criteria**

### **Expected Results:**
- ✅ **Zero Blocking**: No time update freezes during 5D periods
- ✅ **Instant Results**: 5D results delivered immediately at t=0s
- ✅ **Consistent Results**: Same result across all WebSocket instances
- ✅ **Load Distribution**: Even distribution across all instances
- ✅ **High Availability**: System continues working if some instances fail

### **Load Testing:**
```bash
# Test with multiple clients
# Verify consistent results across instances
# Monitor performance under load
# Check failover scenarios
```

---

## 🚨 **Common Issues and Solutions**

### **1. Scheduler Not Running:**
```bash
# Check if scheduler is started
pm2 list | grep 5d-precalc-scheduler

# Restart scheduler
pm2 restart 5d-precalc-scheduler

# Check logs for errors
pm2 logs 5d-precalc-scheduler
```

### **2. WebSocket Instances Not Receiving Results:**
```bash
# Check Redis connectivity
redis-cli ping

# Check Pub/Sub subscription
pm2 logs websocket-0 | grep "5D_PRECALC_SUB"

# Verify result in Redis
redis-cli get "precalc_5d_result:fiveD:60:default:20250731000000001"
```

### **3. Inconsistent Results:**
```bash
# Check if multiple schedulers are running
pm2 list | grep 5d-precalc-scheduler

# Verify Redis NX flag is working
redis-cli monitor | grep "SET.*NX"

# Check instance tracking in logs
pm2 logs 5d-precalc-scheduler | grep "schedulerInstance"
```

### **4. Load Balancer Issues:**
```bash
# Check load balancer health
curl -I http://your-domain.com/socket.io/

# Check WebSocket upgrade
curl -H "Upgrade: websocket" -H "Connection: Upgrade" http://your-domain.com/socket.io/

# Check load balancer logs
tail -f /var/log/nginx/error.log
```

---

## 📞 **Support**

For issues with load balancer deployment:

1. Check all PM2 processes: `pm2 list`
2. Check scheduler logs: `pm2 logs 5d-precalc-scheduler`
3. Check WebSocket logs: `pm2 logs websocket-0`
4. Verify Redis connectivity: `redis-cli ping`
5. Test load balancer: `curl -I http://your-domain.com/socket.io/`

The system is designed to be resilient and will automatically handle load balancer scenarios with proper safety mechanisms. 