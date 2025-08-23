# 🎰 Casino API Endpoints - Complete Reference

## 🔐 **Authentication Required for All Endpoints**
```
Authorization: Bearer your-auth-token-here
Content-Type: application/json
```

---

## 🎮 **Game Management Endpoints**

### **1. Get All Available Games**
```
GET /api/casino/games
```
**Query Parameters:**
- `provider` (optional): Filter by specific provider
- `category` (optional): Filter by game category
- `search` (optional): Search games by name/category

**Example:**
```
GET /api/casino/games?provider=Pragmatic Play&category=slots
```

### **2. Get All Available Providers**
```
GET /api/casino/providers
```
**Response:** List of all casino game providers

### **3. Launch a Casino Game**
```
POST /api/casino/games/:gameUid/launch
```
**Path Parameters:**
- `gameUid`: Unique game identifier

**Query Parameters:**
- `currency` (optional): Game currency (default: INR)
- `language` (optional): Game language (default: en)
- `platform` (optional): Platform type (default: web)

**Example:**
```
POST /api/casino/games/slot_000001/launch?currency=INR&language=en
```

---

## 📋 **Session Management Endpoints**

### **4. Get User's Casino Sessions**
```
GET /api/casino/sessions
```
**Query Parameters:**
- `status` (optional): Filter by status (active/inactive)
- `limit` (optional): Number of sessions (default: 10)
- `offset` (optional): Pagination offset (default: 0)

**Example:**
```
GET /api/casino/sessions?status=active&limit=20
```

### **5. Close a Casino Game Session**
```
DELETE /api/casino/sessions/:sessionId
```
**Path Parameters:**
- `sessionId`: Session ID to close

**Example:**
```
DELETE /api/casino/sessions/12345
```

---

## 💰 **Transaction Endpoints**

### **6. Get User's Casino Transactions**
```
GET /api/casino/transactions
```
**Query Parameters:**
- `type` (optional): Transaction type (bet/win)
- `limit` (optional): Number of transactions (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `fromDate` (optional): Start date filter
- `toDate` (optional): End date filter

**Example:**
```
GET /api/casino/transactions?type=bet&fromDate=2024-01-01&limit=50
```

---

## 📊 **Statistics & Analytics Endpoints**

### **7. Get User's Casino Statistics**
```
GET /api/casino/stats
```
**Response:** User's betting statistics, win/loss data, session counts

---

## 🏥 **Health & System Endpoints**

### **8. Casino API Health Check**
```
GET /api/casino/health
```
**Authentication:** NOT REQUIRED (Public endpoint)

**Response:** API health status and version information

---

## 📞 **Callback Endpoints (External)**

### **9. Casino Provider Callback**
```
POST /api/casino/callback
```
**Authentication:** NOT REQUIRED (Called by casino provider)

**Purpose:** Receive real-time bet/win updates from casino games

---

## 🧪 **Development & Testing Endpoints**

### **10. Test Encryption/Decryption**
```
POST /api/casino/test-encryption
```
**Body:**
```json
{
  "testData": "Hello World"
}
```
**Purpose:** Test AES-256 encryption/decryption functionality

---

## 👑 **Admin-Only Endpoints**

### **11. Get All Casino Transactions (Admin)**
```
GET /api/casino/admin/transactions
```
**Permissions:** Admin access required

**Query Parameters:**
- `fromDate` (optional): Start date filter
- `toDate` (optional): End date filter
- `pageNo` (optional): Page number (default: 1)
- `pageSize` (optional): Page size (default: 30)

---

## 🔧 **Internal Casino Provider Endpoints**

These are the actual endpoints that your system calls on `https://jsgame.live`:

### **Game Launch (SEAMLESS)**
```
POST https://jsgame.live/game/v1
```

### **Game Launch (TRANSFER)**
```
POST https://jsgame.live/game/v2
```

### **Get Game List**
```
POST https://jsgame.live/game/list
```

### **Get Provider List**
```
POST https://jsgame.live/game/provider/list
```

### **Get Transaction List**
```
POST https://jsgame.live/game/transaction/list
```

### **Check User Balance**
```
POST https://jsgame.live/game/balance/check
```

### **Get User Information**
```
POST https://jsgame.live/game/user/info
```

---

## 📝 **Request/Response Format**

### **All Casino Provider API Calls:**
- **Method:** POST
- **Headers:** Content-Type: application/json
- **Body:** AES-256 encrypted payload
- **Response:** AES-256 encrypted response

### **Your Internal API Calls:**
- **Method:** GET/POST/DELETE
- **Headers:** Authorization: Bearer {token}
- **Body:** JSON (for POST requests)
- **Response:** JSON with success/error structure

---

## 🎯 **Common Use Cases**

### **1. Browse Games by Provider:**
```
GET /api/casino/games?provider=Pragmatic Play
```

### **2. Search for Specific Game Types:**
```
GET /api/casino/games?category=slots&search=Dragon
```

### **3. Get User's Betting History:**
```
GET /api/casino/transactions?type=bet&limit=100
```

### **4. Launch a Specific Game:**
```
POST /api/casino/games/slot_000001/launch?currency=INR
```

### **5. Check Active Sessions:**
```
GET /api/casino/sessions?status=active
```

---

## 🚨 **Error Handling**

### **Common HTTP Status Codes:**
- **200:** Success
- **400:** Bad Request (invalid parameters)
- **401:** Unauthorized (missing/invalid token)
- **403:** Forbidden (insufficient permissions)
- **404:** Not Found (resource doesn't exist)
- **500:** Internal Server Error

### **Error Response Format:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

---

## ⚡ **Performance Notes**

- **Real API Priority:** System tries actual casino provider first
- **Fallback System:** Comprehensive fallback ensures data availability
- **No Artificial Limits:** Truly unlimited game generation
- **Server-Side Filtering:** All filtering done on server for performance
- **Caching:** Consider implementing Redis caching for frequently accessed data

---

## 🔒 **Security Features**

- **AES-256 Encryption:** All casino provider communications encrypted
- **JWT Authentication:** Secure token-based authentication
- **Timestamp Validation:** Prevents replay attacks
- **Input Validation:** Comprehensive parameter validation
- **Rate Limiting:** Built-in rate limiting for API protection

---

## 📞 **Support & Troubleshooting**

For issues with specific endpoints:
1. Check authentication token validity
2. Verify endpoint URL and parameters
3. Check server logs for detailed error messages
4. Ensure casino provider credentials are correct
5. Verify network connectivity to casino provider

---

## 🎉 **Quick Start**

1. **Get authentication token** from login endpoint
2. **Test health check:** `GET /api/casino/health`
3. **Browse providers:** `GET /api/casino/providers`
4. **Browse games:** `GET /api/casino/games`
5. **Launch a game:** `POST /api/casino/games/{gameId}/launch`

All endpoints are now properly configured and ready to use! 🎰✨
