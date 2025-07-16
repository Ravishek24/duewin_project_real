# Manual Verification Guide: Exposure Monitoring System

## 🚀 Quick Start Verification

### Step 1: Check if Server is Running
```bash
# Check if the backend server is running
curl http://localhost:3000/api/admin/direct-login -X POST -H "Content-Type: application/json" -d '{"email":"admin@example.com"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Direct admin login successful (for testing only)",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

### Step 2: Test Authentication
```bash
# Save the token from step 1
TOKEN="your_token_here"

# Test authentication
curl http://localhost:3000/api/admin/exposure/all \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "rooms": {
    "wingo-30s": {
      "room": "wingo-30s",
      "duration": 30,
      "exposures": {
        "number:0": "150.50",
        "number:1": "200.25",
        // ... numbers 0-9
      },
      "analysis": {
        "totalExposure": "1250.75",
        "optimalNumber": 3,
        "zeroExposureNumbers": [7, 8],
        "highestExposure": "300.00",
        "minExposure": "0.00"
      }
    }
    // ... other rooms
  }
}
```

### Step 3: Test Individual Room
```bash
# Test specific room (30s)
curl http://localhost:3000/api/admin/exposure/room/30 \
  -H "Authorization: Bearer $TOKEN"
```

### Step 4: Test WebSocket Connection
```bash
# Install wscat if not installed
npm install -g wscat

# Connect to WebSocket
wscat -c "ws://localhost:3000/admin-exposure?token=$TOKEN"
```

**Send subscription message:**
```json
{"type":"subscribe","rooms":["wingo-30s","wingo-60s","wingo-180s","wingo-300s"]}
```

**Expected real-time updates:**
```json
{"type":"exposure_update","room":"wingo-30s","exposures":{"number:0":"150.50"},"analysis":{"totalExposure":"1250.75","optimalNumber":3}}
```

## 🔍 Detailed Verification Steps

### 1. Check Redis Data
```bash
# Connect to Redis
redis-cli

# Check exposure data for 30s room
HGETALL exposure:wingo:30:default:20241201T143000

# Expected format:
# number:0 -> "15050" (in cents)
# number:1 -> "20025"
# ... etc
```

### 2. Check Period Status
```bash
# Get current period
PERIOD=$(date -u +"%Y%m%dT%H%M%S" | sed 's/..$//')

# Check period status
curl "http://localhost:3000/api/admin/games/wingo/period/$PERIOD/status" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test Admin Override (when period ends)
```bash
# Set result (only works when period countdown = 0)
curl http://localhost:3000/api/admin/games/wingo/set-result \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration":30,"number":5}'
```

## ✅ Verification Checklist

### Authentication & Authorization
- [ ] Admin login works
- [ ] JWT token is valid
- [ ] IP whitelist allows your IP
- [ ] Token includes admin permissions

### API Endpoints
- [ ] `/api/admin/exposure/all` returns all rooms
- [ ] `/api/admin/exposure/room/{duration}` returns specific room
- [ ] Exposure values are in rupees (not cents)
- [ ] Optimal number is calculated correctly
- [ ] Zero exposure numbers are identified

### WebSocket Connection
- [ ] WebSocket connects successfully
- [ ] Subscription to rooms works
- [ ] Real-time updates are received
- [ ] Messages are properly formatted

### Redis Data
- [ ] Redis connection works
- [ ] Exposure data exists for active periods
- [ ] Data format is correct (cents stored, rupees displayed)
- [ ] Period keys are properly formatted

### Admin Override
- [ ] Period status endpoint works
- [ ] Override only works when period ends
- [ ] Result is set correctly
- [ ] User balances are updated

## 🚨 Common Issues & Solutions

### Issue 1: Authentication Failed
**Symptoms:** 401 Unauthorized errors
**Solutions:**
- Check if admin user exists in database
- Verify JWT_SECRET environment variable
- Ensure IP is whitelisted

### Issue 2: No Exposure Data
**Symptoms:** Empty exposure values
**Solutions:**
- Check if bets are being placed
- Verify Redis connection
- Check exposure calculation logic

### Issue 3: WebSocket Connection Failed
**Symptoms:** WebSocket connection timeout
**Solutions:**
- Check if WebSocket server is running
- Verify token is valid
- Check firewall settings

### Issue 4: Override Not Working
**Symptoms:** Override returns error
**Solutions:**
- Check if period has ended (countdown = 0)
- Verify admin permissions
- Check game logic service

## 📊 Performance Verification

### Check Response Times
```bash
# Test API response time
time curl http://localhost:3000/api/admin/exposure/all \
  -H "Authorization: Bearer $TOKEN"

# Should be < 500ms
```

### Check Memory Usage
```bash
# Check Redis memory
redis-cli info memory

# Check Node.js memory
ps aux | grep node
```

### Check WebSocket Latency
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3000/admin-exposure?token=YOUR_TOKEN');
const start = Date.now();
ws.onopen = () => console.log('Connection time:', Date.now() - start, 'ms');
```

## 🎯 Expected Behavior

### Normal Operation
1. **Exposure Updates:** Real-time updates every 5 seconds
2. **Optimal Number:** Always shows number with lowest exposure
3. **Period Countdown:** Accurate countdown timer
4. **Bet Distribution:** Shows current bet counts
5. **Admin Override:** Only available when period ends

### Data Format
- **Exposure:** Displayed in rupees (e.g., "150.50")
- **Stored:** In cents (e.g., 15050)
- **Optimal:** Number with minimum exposure
- **Period:** ISO format (e.g., "20241201T143000")

### Security
- **Authentication:** JWT token required
- **Authorization:** Admin role required
- **IP Whitelist:** Admin IPs only
- **Override:** Only when period ends

## 🧪 Run Automated Tests

```bash
# Run comprehensive test suite
node test-exposure-system.js
```

**Expected Output:**
```
🧪 Starting Exposure System Tests...

🔐 Testing Authentication...
✅ Authentication successful

📡 Testing API Endpoints...
✅ All exposure endpoint working
   📊 Rooms found: 4
   🎮 wingo-30s: Exposure ₹1250.75, Optimal: 3
   🎮 wingo-60s: Exposure ₹980.25, Optimal: 7
   🎮 wingo-180s: Exposure ₹1450.50, Optimal: 2
   🎮 wingo-300s: Exposure ₹1120.00, Optimal: 8

🗄️ Testing Redis Data...
✅ Redis connection successful
✅ Redis data found for 30s room
   📊 Total exposure: ₹1250.75

🔌 Testing WebSocket Connection...
✅ WebSocket connection established
✅ Subscribed to all rooms

🔄 Testing Real-time Updates...
✅ Received 3 real-time updates

🎮 Testing Admin Override...
✅ Period status check working
   📊 Period: 20241201T143000, Can Override: false
⚠️ Override not allowed (period not ended)

⏰ Testing Period Status...
✅ Period status for 30s: Active=true, TimeRemaining=15s
✅ Period status for 60s: Active=true, TimeRemaining=45s
✅ Period status for 180s: Active=true, TimeRemaining=120s
✅ Period status for 300s: Active=true, TimeRemaining=240s

📋 Test Report
=============
✅ Passed: 12
❌ Failed: 0
⏭️ Skipped: 0
📊 Total: 12

🎉 All tests passed! Exposure system is working correctly.
```

## 🎉 Success Criteria

The exposure monitoring system is working correctly if:

1. ✅ All API endpoints return valid data
2. ✅ WebSocket provides real-time updates
3. ✅ Exposure values are in rupees
4. ✅ Optimal numbers are calculated correctly
5. ✅ Admin override works when periods end
6. ✅ No authentication or authorization errors
7. ✅ Response times are under 500ms
8. ✅ All 4 rooms (30s, 1m, 3m, 5m) are accessible

If all criteria are met, the system is ready for production use! 