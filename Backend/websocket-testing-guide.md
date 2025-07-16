# WebSocket Testing Guide

## 🧪 **Quick Test Commands**

### 1. Run Step-by-Step Verification
```bash
cd Backend
node verify-websocket-steps.js
```

### 2. Run Comprehensive Test
```bash
cd Backend
node test-websocket-real-time.js
```

## 📋 **Manual Testing Steps**

### Step 1: Check Server Status
```bash
curl http://localhost:8000/health
```
**Expected:** `{"status":"ok","timestamp":"...","uptime":...}`

### Step 2: Get Admin Token
```bash
curl -X POST http://localhost:8000/api/admin/direct-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```
**Expected:** `{"success":true,"data":{"token":"..."}}`

### Step 3: Test API Endpoints
```bash
# Replace TOKEN with actual token
TOKEN="your_token_here"

# Test all exposure
curl http://localhost:8000/api/admin/exposure/all \
  -H "Authorization: Bearer $TOKEN"

# Test specific room
curl http://localhost:8000/api/admin/exposure/room/30 \
  -H "Authorization: Bearer $TOKEN"
```

### Step 4: Test WebSocket Connection
```bash
# Install wscat if not installed
npm install -g wscat

# Connect to WebSocket (replace TOKEN)
wscat -c "ws://localhost:8000/admin-exposure?token=YOUR_TOKEN"
```

### Step 5: Send Subscription Message
```json
{"type":"subscribe","rooms":["wingo-30s","wingo-60s","wingo-180s","wingo-300s"]}
```

### Step 6: Monitor Real-time Updates
**Expected Messages:**
```json
{
  "type": "exposure_update",
  "room": "wingo-30s",
  "exposures": {
    "number:0": "150.50",
    "number:1": "200.25"
  },
  "analysis": {
    "totalExposure": "1250.75",
    "optimalNumber": 3
  },
  "periodInfo": {
    "timeRemaining": 15
  }
}
```

## 🔍 **What to Look For**

### ✅ **Success Indicators:**
1. **Server responds** to health check
2. **Authentication works** and returns token
3. **API endpoints** return exposure data
4. **WebSocket connects** without errors
5. **Subscription accepted** by server
6. **Real-time updates** received every 5-10 seconds
7. **Period countdown** shows correct time remaining
8. **Exposure values** are in rupees (not cents)

### ❌ **Failure Indicators:**
1. **Connection refused** - Server not running
2. **401 Unauthorized** - Authentication failed
3. **403 Forbidden** - IP not whitelisted
4. **WebSocket timeout** - Connection issues
5. **No messages received** - Subscription failed
6. **Invalid data format** - Parsing errors

## 📊 **Expected Data Format**

### Period Information:
```json
{
  "periodId": "20241201T143000",
  "startTime": "2024-12-01T14:30:00.000Z",
  "endTime": "2024-12-01T14:30:30.000Z",
  "timeRemaining": 15,
  "duration": 30
}
```

### Exposure Data:
```json
{
  "exposures": {
    "number:0": "150.50",
    "number:1": "200.25",
    "number:2": "0.00",
    "number:3": "75.00",
    "number:4": "300.00",
    "number:5": "125.50",
    "number:6": "0.00",
    "number:7": "50.25",
    "number:8": "0.00",
    "number:9": "100.00"
  },
  "analysis": {
    "totalExposure": "1001.50",
    "optimalNumber": 2,
    "zeroExposureNumbers": [2, 6, 8],
    "highestExposure": "300.00",
    "minExposure": "0.00"
  }
}
```

## 🎯 **Testing Scenarios**

### Scenario 1: No Bets Placed
**Expected Behavior:**
- All exposure values = "0.00"
- Optimal number = 0 (or any number with 0 exposure)
- Zero exposure numbers = [0,1,2,3,4,5,6,7,8,9]

### Scenario 2: Some Bets Placed
**Expected Behavior:**
- Some exposure values > "0.00"
- Optimal number = number with lowest exposure
- Real-time updates show changing values

### Scenario 3: Period Ending
**Expected Behavior:**
- Time remaining decreases to 0
- Period update messages received
- New period starts automatically

## 🚨 **Troubleshooting**

### Issue 1: WebSocket Connection Failed
```bash
# Check if server is running
curl http://localhost:8000/health

# Check if WebSocket server is initialized
grep "WebSocket server" logs/app.log
```

### Issue 2: No Real-time Updates
```bash
# Check if exposure service is running
grep "exposure monitoring" logs/app.log

# Check Redis connection
redis-cli ping
```

### Issue 3: Invalid Token
```bash
# Get fresh token
curl -X POST http://localhost:8000/api/admin/direct-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```

### Issue 4: IP Not Whitelisted
```bash
# Check your IP
curl https://api.ipify.org

# Add to environment
export ADMIN_IP_WHITELIST="127.0.0.1,::1,YOUR_IP"
```

## 📈 **Performance Testing**

### Test Message Frequency
```bash
# Count messages in 1 minute
timeout 60 wscat -c "ws://localhost:8000/admin-exposure?token=TOKEN" | wc -l
```

### Test Response Time
```bash
# Measure API response time
time curl http://localhost:8000/api/admin/exposure/all \
  -H "Authorization: Bearer TOKEN"
```

## ✅ **Verification Checklist**

- [ ] Server health check passes
- [ ] Admin authentication works
- [ ] API endpoints return data
- [ ] WebSocket connects successfully
- [ ] Subscription message accepted
- [ ] Real-time updates received
- [ ] Period countdown accurate
- [ ] Exposure values in rupees
- [ ] Optimal number calculated correctly
- [ ] No error messages in logs

## 🎉 **Success Criteria**

The WebSocket system is working correctly if:

1. ✅ **Connection established** without errors
2. ✅ **Real-time updates** received every 5-10 seconds
3. ✅ **Period countdown** shows accurate time remaining
4. ✅ **Exposure data** updates in real-time
5. ✅ **Optimal number** highlights correctly
6. ✅ **No connection drops** during testing
7. ✅ **Message format** is valid JSON
8. ✅ **All 4 rooms** (30s, 1m, 3m, 5m) are accessible

Run the test scripts to verify all functionality! 