# 🚀 5D Pre-Calculation System - Single Instance Deployment Guide

## 📋 **Overview**

This guide explains how to deploy the 5D Independent Pre-Calculation System on the **same instance** as your WebSocket service. This is the **recommended approach** for single instance setups.

---

## 🏗️ **Single Instance Architecture**

### **Your Current Setup:**
```
Single Server Instance
├── WebSocket Service (Main App) - PM2 Process
├── Redis (Shared)
├── Database (Shared)
└── [NEW] 5D Pre-Calculation Scheduler - PM2 Process
```

### **How It Works:**
```
5D Pre-Calculation Scheduler (Same Instance)
├── Monitors 5D periods independently
├── Triggers pre-calculation at t=5s (bet freeze)
├── Calculates result with final bet patterns
├── Stores result in Redis
└── Publishes completion notification

WebSocket Service (Same Instance)
├── Subscribes to Redis Pub/Sub notifications
├── Receives pre-calculated results
├── Stores results in memory
└── Delivers instant results at t=0s
```

---

## 🚀 **Deployment Steps**

### **Step 1: Verify Current Setup**

```bash
# Check your current PM2 processes
pm2 list

# Check if your WebSocket service is running
pm2 logs strike-backend --lines 5
# or
pm2 logs app --lines 5
```

### **Step 2: Deploy 5D Pre-Calculation Scheduler**

```bash
# Navigate to your Backend directory
cd Backend

# Make the startup script executable
chmod +x start-5d-precalc-same-instance.sh

# Start the 5D pre-calculation scheduler
./start-5d-precalc-same-instance.sh
```

### **Step 3: Verify Deployment**

```bash
# Check all PM2 processes
pm2 list

# You should see both:
# - Your main WebSocket service
# - 5d-precalc-scheduler

# Check scheduler logs
pm2 logs 5d-precalc-scheduler --lines 10

# Check WebSocket logs for subscription
pm2 logs strike-backend | grep "5D_PRECALC_SUB"
```

### **Step 4: Test the System**

```bash
# Run the test suite
node test-5d-independent-precalc.js

# Monitor real-time
pm2 monit
```

---

## 🔍 **Monitoring and Debugging**

### **Key Log Messages:**

#### **5D Pre-Calculation Scheduler:**
```
🔄 [5D_PRECALC_MONITOR] Starting 5D pre-calculation monitoring...
🎯 [5D_PRECALC_TRIGGER] Bet freeze detected for fiveD_60, period 20250731000000001 (t=4.5s)
🎯 [5D_PRECALC_EXEC] Starting pre-calculation for period 20250731000000001
✅ [5D_PRECALC_EXEC] Bet freeze confirmed for period 20250731000000001
📊 [5D_PRECALC_EXEC] Retrieved bet patterns for period 20250731000000001
💾 [5D_PRECALC_EXEC] Result stored in Redis for period 20250731000000001
✅ [5D_PRECALC_EXEC] Pre-calculation completed for period 20250731000000001 in 2710ms
```

#### **WebSocket Service:**
```
🔄 [5D_PRECALC_SUB] Setting up 5D pre-calculation subscription...
✅ [5D_PRECALC_COMPLETED] Pre-calculation completed for fiveD_60_20250731000000001
💾 [5D_PRECALC_COMPLETED] Result stored for fiveD_60_20250731000000001 by websocket_instance
🎯 [5D_PERIOD_END] fiveD_60: Checking for pre-calculated result for period 20250731000000001
✅ [5D_PERIOD_END] fiveD_60: Using pre-calculated result for period 20250731000000001
```

### **Troubleshooting Commands:**

#### **1. Check Both Processes:**
```bash
# Check all processes
pm2 list

# Check scheduler status
pm2 show 5d-precalc-scheduler

# Check WebSocket status
pm2 show strike-backend
# or
pm2 show app
```

#### **2. Check Logs:**
```bash
# Check scheduler logs
pm2 logs 5d-precalc-scheduler --lines 50

# Check WebSocket logs
pm2 logs strike-backend --lines 50
# or
pm2 logs app --lines 50

# Check both logs together
pm2 logs --lines 20
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

#### **4. Check System Resources:**
```bash
# Monitor all processes
pm2 monit

# Check system resources
htop

# Check memory usage
free -h

# Check disk space
df -h
```

---

## 🛡️ **Safety Features for Single Instance**

### **1. Process Isolation:**
```javascript
// 5D pre-calculation runs in separate PM2 process
// No interference with main WebSocket service
```

### **2. Memory Management:**
```javascript
// Optimized memory limits for single instance
max_memory_restart: '256M' // Lower limit for scheduler
node_args: '--max-old-space-size=256' // Lower Node.js limit
```

### **3. Error Handling:**
```javascript
// If scheduler fails, WebSocket continues working
// Fallback to real-time calculation if pre-calculated result missing
```

### **4. Resource Monitoring:**
```bash
# Monitor both processes
pm2 monit

# Check resource usage
pm2 show 5d-precalc-scheduler
pm2 show strike-backend
```

---

## 📊 **Performance Monitoring**

### **Key Metrics to Monitor:**

#### **1. Scheduler Performance:**
- Pre-calculation success rate
- Execution time per period (should be ~2-3 seconds)
- Memory usage (should stay under 256MB)
- CPU usage

#### **2. WebSocket Performance:**
- Result retrieval time
- Memory usage
- Client connection count
- Response time

#### **3. System Performance:**
- Overall memory usage
- CPU usage
- Disk space
- Network connectivity

### **Monitoring Commands:**
```bash
# Monitor all processes
pm2 monit

# Check system resources
htop

# Monitor memory usage
pm2 show 5d-precalc-scheduler | grep memory
pm2 show strike-backend | grep memory

# Check logs for performance
pm2 logs 5d-precalc-scheduler | grep "executionTime"
```

---

## ✅ **Success Criteria**

### **Expected Results:**
- ✅ **Zero Blocking**: No time update freezes during 5D periods
- ✅ **Instant Results**: 5D results delivered immediately at t=0s
- ✅ **Accurate Protection**: Protection logic uses final bet patterns
- ✅ **System Stability**: Both processes run independently
- ✅ **Resource Efficiency**: Minimal additional resource usage

### **Performance Expectations:**
- **Memory Usage**: Additional ~200-300MB for scheduler
- **CPU Usage**: Minimal impact during non-5D periods
- **Execution Time**: 2-3 seconds for 5D pre-calculation
- **Success Rate**: 95%+ pre-calculation success rate

---

## 🚨 **Common Issues and Solutions**

### **1. Scheduler Not Starting:**
```bash
# Check if scheduler is started
pm2 list | grep 5d-precalc-scheduler

# Restart scheduler
pm2 restart 5d-precalc-scheduler

# Check logs for errors
pm2 logs 5d-precalc-scheduler
```

### **2. WebSocket Not Receiving Results:**
```bash
# Check Redis connectivity
redis-cli ping

# Check Pub/Sub subscription
pm2 logs strike-backend | grep "5D_PRECALC_SUB"

# Verify result in Redis
redis-cli get "precalc_5d_result:fiveD:60:default:20250731000000001"
```

### **3. High Memory Usage:**
```bash
# Check memory usage
pm2 show 5d-precalc-scheduler | grep memory

# Restart if memory usage is high
pm2 restart 5d-precalc-scheduler

# Check system memory
free -h
```

### **4. Performance Issues:**
```bash
# Monitor both processes
pm2 monit

# Check CPU usage
htop

# Check logs for errors
pm2 logs 5d-precalc-scheduler --lines 100
pm2 logs strike-backend --lines 100
```

---

## 🔧 **Maintenance Commands**

### **Daily Operations:**
```bash
# Check status
pm2 list

# Monitor performance
pm2 monit

# Check logs
pm2 logs 5d-precalc-scheduler --lines 20
pm2 logs strike-backend --lines 20
```

### **Restart Operations:**
```bash
# Restart scheduler only
pm2 restart 5d-precalc-scheduler

# Restart WebSocket only
pm2 restart strike-backend

# Restart both
pm2 restart all
```

### **Update Operations:**
```bash
# Stop scheduler
pm2 stop 5d-precalc-scheduler

# Update code
git pull

# Start scheduler
pm2 start 5d-precalc-scheduler
```

---

## 📞 **Support**

For issues with single instance deployment:

1. Check both PM2 processes: `pm2 list`
2. Check scheduler logs: `pm2 logs 5d-precalc-scheduler`
3. Check WebSocket logs: `pm2 logs strike-backend`
4. Verify Redis connectivity: `redis-cli ping`
5. Monitor system resources: `pm2 monit`

The system is designed to be lightweight and efficient for single instance deployment while providing all the benefits of the 5D pre-calculation system. 