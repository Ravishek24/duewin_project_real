# Enhanced Wingo Exposure API Documentation

## Quick Reference for Frontend Integration

### 🔗 WebSocket Connection
```javascript
const socket = io('http://your-backend-url/admin', {
  auth: { token: 'your-admin-jwt-token' }
});
```

### 📡 WebSocket Events

#### 1. Subscribe to Wingo Exposure
```javascript
// Subscribe to specific duration
socket.emit('subscribeToWingoExposure', { duration: 30 }); // 30s
socket.emit('subscribeToWingoExposure', { duration: 60 }); // 1m
socket.emit('subscribeToWingoExposure', { duration: 180 }); // 3m
socket.emit('subscribeToWingoExposure', { duration: 300 }); // 5m
```

#### 2. Get User Details for Number
```javascript
socket.emit('getUserDetailsForNumber', {
  duration: 30,
  number: 5
});
```

#### 3. Listen for Updates
```javascript
// Enhanced exposure updates
socket.on('wingoExposureUpdate', (data) => {
  console.log('Enhanced exposure data:', data);
});

// User details response
socket.on('userDetailsForNumber', (data) => {
  console.log('User details:', data);
});

// All rooms summary (every 2.5s)
socket.on('allWingoRoomsUpdate', (data) => {
  console.log('All rooms data:', data);
});
```

### 📊 Data Structure

#### Enhanced Exposure Response
```javascript
{
  "success": true,
  "duration": 30,
  "periodId": "20241201T143000",
  "timestamp": "2024-12-01T14:30:00.000Z",
  
  // Enhanced exposure data
  "numbers": {
    "0": { amount: 4500, users: 2, totalBetAmount: 35.00 },
    "1": { amount: 3200, users: 1, totalBetAmount: 12.50 },
    // ... numbers 2-9
  },
  
  // User tracking data
  "userDetails": {
    "0": [
      { userId: "user123", betAmount: 15.00, betType: "COLOR", betValue: "red", timestamp: 1703123456789 },
      { userId: "user456", betAmount: 20.00, betType: "NUMBER", betValue: "0", timestamp: 1703123456790 }
    ]
  },
  
  // Statistics
  "statistics": {
    "number:0": { totalUsers: 2, totalBetAmount: 35.00, uniqueUsers: 2, betTypes: { "COLOR": 1, "NUMBER": 1 } }
  },
  
  // Period summary
  "periodSummary": {
    totalUsers: 3,
    totalBetAmount: 47.50,
    uniqueUsers: 3,
    totalBets: 3
  }
}
```

#### User Details Response
```javascript
{
  "success": true,
  "number": 5,
  "duration": 30,
  "users": [
    {
      userId: "user123",
      betAmount: 15.00,
      betType: "COLOR",
      betValue: "red",
      timestamp: 1703123456789
    }
  ],
  "statistics": {
    totalUsers: 1,
    totalBetAmount: 15.00,
    uniqueUsers: 1,
    betTypes: { "COLOR": 1 }
  }
}
```

### 🎨 UI Implementation Examples

#### 1. Display Number with User Count
```javascript
function renderNumber(number, data) {
  return `
    <div class="number-card" onclick="showUserDetails(${number})">
      <div class="number">${number}</div>
      <div class="exposure">₹${(data.amount / 100).toFixed(2)}</div>
      <div class="user-count">👥 ${data.users} users</div>
      <div class="total-bet">💰 ₹${data.totalBetAmount.toFixed(2)}</div>
    </div>
  `;
}
```

#### 2. User Details Modal
```javascript
function showUserDetailsModal(data) {
  const { number, users, statistics } = data;
  
  const modal = `
    <div class="modal">
      <h3>Number ${number} - User Details</h3>
      <div class="stats">
        <span>Total Users: ${statistics.totalUsers}</span>
        <span>Total Amount: ₹${statistics.totalBetAmount.toFixed(2)}</span>
      </div>
      <div class="users">
        ${users.map(user => `
          <div class="user">
            <span>${user.userId}</span>
            <span>₹${user.betAmount.toFixed(2)}</span>
            <span>${user.betType}: ${user.betValue}</span>
            <span>${new Date(user.timestamp).toLocaleTimeString()}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modal);
}
```

#### 3. Duration Tabs
```javascript
function createDurationTabs() {
  const durations = [30, 60, 180, 300];
  
  return durations.map(duration => `
    <button class="duration-tab" onclick="switchDuration(${duration})">
      ${duration}s
    </button>
  `).join('');
}

function switchDuration(duration) {
  socket.emit('subscribeToWingoExposure', { duration });
  // Update UI to show active tab
}
```

### 🔧 Configuration

#### Required Environment Variables
```bash
# Backend
ADMIN_JWT_SECRET=your_secret_here
REDIS_URL=redis://localhost:6379

# Frontend
BACKEND_URL=http://your-backend-url
ADMIN_TOKEN=your-admin-jwt-token
```

#### CORS Setup (if needed)
```javascript
// Backend
app.use(cors({
  origin: ['http://localhost:3000', 'http://your-frontend-domain.com'],
  credentials: true
}));
```

### 🚨 Error Handling

#### WebSocket Error Handling
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
  // Show error message to user
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
  // Handle specific errors
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Implement reconnection logic
});
```

#### API Error Response Format
```javascript
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

### 📱 Mobile Responsive CSS
```css
.number-card {
  background: white;
  border-radius: 10px;
  padding: 15px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s;
}

@media (max-width: 768px) {
  .numbers-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  
  .number-card {
    padding: 10px;
    font-size: 0.9em;
  }
}

@media (max-width: 480px) {
  .numbers-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### ✅ Testing Checklist

- [ ] WebSocket connection established
- [ ] Duration switching works
- [ ] Real-time updates received
- [ ] User details modal opens
- [ ] Mobile responsive design
- [ ] Error handling works
- [ ] Reconnection logic works
- [ ] Performance is acceptable

### 🆘 Common Issues

1. **Connection Failed**: Check backend URL and token
2. **No Updates**: Verify duration subscription
3. **Modal Not Opening**: Check event handlers
4. **Mobile Issues**: Test responsive design
5. **Performance**: Implement debouncing for frequent updates

This documentation provides everything needed for quick frontend integration with the enhanced exposure tracking system. 