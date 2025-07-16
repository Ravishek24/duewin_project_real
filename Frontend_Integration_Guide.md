# Frontend Integration Guide: Admin Exposure Monitoring System

## Overview
This guide provides step-by-step instructions for frontend developers to integrate with the live admin exposure monitoring system for Wingo games across 4 durations (30s, 1m, 3m, 5m).

## 🔐 Authentication Setup

### Step 1: Admin Login
```javascript
// 1. Login to get JWT token
const loginAdmin = async (email) => {
  try {
    const response = await fetch('/api/admin/direct-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('adminToken', data.data.token);
      return data.data.token;
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};

// Usage
const token = await loginAdmin('admin@example.com');
```

### Step 2: Include Token in Requests
```javascript
// Add this to all API requests
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
};
```

## 📊 REST API Endpoints

### Step 3: Get All Wingo Rooms Exposure
```javascript
const getAllExposure = async () => {
  try {
    const response = await fetch('/api/admin/exposure/all', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching exposure:', error);
  }
};

// Response format:
{
  "success": true,
  "rooms": {
    "wingo-30s": {
      "room": "wingo-30s",
      "duration": 30,
      "periodId": "20241201T143000",
      "timestamp": "2024-12-01T14:30:00.000Z",
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
        "minExposure": "0.00",
        "betDistribution": {
          "numbers": [...],
          "colors": {...},
          "odd_even": {...},
          "size": {...}
        }
      },
      "periodInfo": {
        "startTime": "2024-12-01T14:30:00.000Z",
        "endTime": "2024-12-01T14:30:30.000Z",
        "timeRemaining": 15,
        "duration": 30
      }
    }
    // ... other rooms (wingo-60s, wingo-180s, wingo-300s)
  }
}
```

### Step 4: Get Specific Room Exposure
```javascript
const getRoomExposure = async (duration) => {
  try {
    const response = await fetch(`/api/admin/exposure/room/${duration}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching room exposure:', error);
  }
};

// Usage
const room30s = await getRoomExposure(30);
const room1m = await getRoomExposure(60);
const room3m = await getRoomExposure(180);
const room5m = await getRoomExposure(300);
```

## 🔄 WebSocket Real-time Updates

### Step 5: WebSocket Connection Setup
```javascript
class ExposureWebSocket {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('adminToken');
      
      this.ws = new WebSocket(`ws://localhost:3000/admin-exposure?token=${token}`);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected to admin exposure');
        this.reconnectAttempts = 0;
        
        // Subscribe to all rooms
        this.subscribeToAllRooms();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        this.handleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  }

  subscribeToAllRooms() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'subscribe',
        rooms: ['wingo-30s', 'wingo-60s', 'wingo-180s', 'wingo-300s']
      };
      this.ws.send(JSON.stringify(subscribeMessage));
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case 'exposure_update':
        this.updateExposureDisplay(data);
        break;
      case 'period_update':
        this.updatePeriodInfo(data);
        break;
      case 'bet_distribution_update':
        this.updateBetDistribution(data);
        break;
      case 'error':
        console.error('WebSocket error:', data.message);
        break;
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Initialize WebSocket
const exposureWS = new ExposureWebSocket();
exposureWS.connect();
```

### Step 6: Handle Real-time Updates
```javascript
// Update exposure display
updateExposureDisplay(data) {
  const { room, exposures, analysis } = data;
  
  // Update exposure numbers
  Object.keys(exposures).forEach(key => {
    const number = key.split(':')[1];
    const exposure = exposures[key];
    
    // Update UI element
    const element = document.getElementById(`exposure-${room}-${number}`);
    if (element) {
      element.textContent = `₹${exposure}`;
      
      // Highlight optimal number
      if (number == analysis.optimalNumber) {
        element.classList.add('optimal-number');
      } else {
        element.classList.remove('optimal-number');
      }
    }
  });
  
  // Update analysis
  document.getElementById(`total-exposure-${room}`).textContent = `₹${analysis.totalExposure}`;
  document.getElementById(`optimal-number-${room}`).textContent = analysis.optimalNumber;
  document.getElementById(`highest-exposure-${room}`).textContent = `₹${analysis.highestExposure}`;
}

// Update period information
updatePeriodInfo(data) {
  const { room, periodInfo } = data;
  
  document.getElementById(`time-remaining-${room}`).textContent = 
    `${Math.floor(periodInfo.timeRemaining / 60)}:${(periodInfo.timeRemaining % 60).toString().padStart(2, '0')}`;
  
  // Update progress bar
  const progress = ((periodInfo.duration - periodInfo.timeRemaining) / periodInfo.duration) * 100;
  document.getElementById(`progress-${room}`).style.width = `${progress}%`;
}

// Update bet distribution
updateBetDistribution(data) {
  const { room, betDistribution } = data;
  
  // Update number bets
  betDistribution.numbers.forEach((bet, index) => {
    const element = document.getElementById(`bet-count-${room}-${index}`);
    if (element) {
      element.textContent = bet.bet_count;
    }
  });
  
  // Update color bets
  Object.keys(betDistribution.colors).forEach(color => {
    const element = document.getElementById(`bet-${room}-${color}`);
    if (element) {
      element.textContent = betDistribution.colors[color].bet_count;
    }
  });
}
```

## 🎮 Admin Override Functionality

### Step 7: Set Wingo Result (Admin Override)
```javascript
const setWingoResult = async (duration, number) => {
  try {
    const response = await fetch('/api/admin/games/wingo/set-result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({
        duration: duration,
        number: number
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error setting Wingo result:', error);
  }
};

// Usage
const result = await setWingoResult(30, 5); // Set result 5 for 30s room
```

### Step 8: Check Period Status for Override
```javascript
const checkPeriodStatus = async (periodId) => {
  try {
    const response = await fetch(`/api/admin/games/wingo/period/${periodId}/status`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking period status:', error);
  }
};

// Response format:
{
  "success": true,
  "data": {
    "periodId": "20241201T143000",
    "isActive": true,
    "timeRemaining": 0,
    "canOverride": true,
    "currentResult": null,
    "betCount": 15,
    "totalBetAmount": 1250.75
  }
}
```

## 🎨 Complete Frontend Implementation Example

### Step 9: Complete Dashboard Component
```javascript
class AdminExposureDashboard {
  constructor() {
    this.rooms = ['wingo-30s', 'wingo-60s', 'wingo-180s', 'wingo-300s'];
    this.currentRoom = 'wingo-30s';
    this.exposureData = {};
    this.ws = null;
    
    this.init();
  }

  async init() {
    await this.setupAuthentication();
    this.setupWebSocket();
    this.loadInitialData();
    this.setupEventListeners();
  }

  async setupAuthentication() {
    // Check if token exists
    const token = localStorage.getItem('adminToken');
    if (!token) {
      // Redirect to login or show login modal
      this.showLoginModal();
    }
  }

  setupWebSocket() {
    this.ws = new ExposureWebSocket();
    this.ws.onMessage = (data) => this.handleWebSocketMessage(data);
    this.ws.connect();
  }

  async loadInitialData() {
    try {
      const data = await getAllExposure();
      if (data.success) {
        this.exposureData = data.rooms;
        this.renderDashboard();
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  renderDashboard() {
    const container = document.getElementById('exposure-dashboard');
    
    container.innerHTML = `
      <div class="dashboard-header">
        <h1>🎮 Wingo Exposure Monitor</h1>
        <div class="room-selector">
          ${this.rooms.map(room => `
            <button class="room-btn ${room === this.currentRoom ? 'active' : ''}" 
                    onclick="dashboard.switchRoom('${room}')">
              ${room.replace('wingo-', '').toUpperCase()}
            </button>
          `).join('')}
        </div>
      </div>
      
      <div class="exposure-grid">
        ${this.renderExposureGrid()}
      </div>
      
      <div class="analysis-panel">
        ${this.renderAnalysisPanel()}
      </div>
      
      <div class="admin-controls">
        ${this.renderAdminControls()}
      </div>
    `;
  }

  renderExposureGrid() {
    const roomData = this.exposureData[this.currentRoom];
    if (!roomData) return '';

    return `
      <div class="exposure-numbers">
        ${Array.from({length: 10}, (_, i) => `
          <div class="exposure-number ${roomData.analysis.optimalNumber === i ? 'optimal' : ''}">
            <div class="number">${i}</div>
            <div class="exposure" id="exposure-${this.currentRoom}-${i}">
              ₹${roomData.exposures[`number:${i}`] || '0.00'}
            </div>
            <div class="bet-count" id="bet-count-${this.currentRoom}-${i}">
              ${roomData.analysis.betDistribution?.numbers[i]?.bet_count || 0}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderAnalysisPanel() {
    const roomData = this.exposureData[this.currentRoom];
    if (!roomData) return '';

    return `
      <div class="analysis-section">
        <h3>📊 Analysis</h3>
        <div class="analysis-grid">
          <div class="analysis-item">
            <label>Total Exposure:</label>
            <span id="total-exposure-${this.currentRoom}">₹${roomData.analysis.totalExposure}</span>
          </div>
          <div class="analysis-item">
            <label>Optimal Number:</label>
            <span id="optimal-number-${this.currentRoom}" class="optimal">${roomData.analysis.optimalNumber}</span>
          </div>
          <div class="analysis-item">
            <label>Highest Exposure:</label>
            <span id="highest-exposure-${this.currentRoom}">₹${roomData.analysis.highestExposure}</span>
          </div>
          <div class="analysis-item">
            <label>Time Remaining:</label>
            <span id="time-remaining-${this.currentRoom}">
              ${Math.floor(roomData.periodInfo.timeRemaining / 60)}:${(roomData.periodInfo.timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  renderAdminControls() {
    return `
      <div class="admin-section">
        <h3>🔧 Admin Controls</h3>
        <div class="override-controls">
          <input type="number" id="override-number" min="0" max="9" placeholder="Enter number (0-9)">
          <button onclick="dashboard.setOverride()" class="override-btn">
            Set Result
          </button>
        </div>
        <div class="status-info" id="override-status"></div>
      </div>
    `;
  }

  switchRoom(room) {
    this.currentRoom = room;
    this.renderDashboard();
  }

  async setOverride() {
    const number = document.getElementById('override-number').value;
    const duration = parseInt(this.currentRoom.replace('wingo-', '').replace('s', ''));
    
    if (!number || number < 0 || number > 9) {
      alert('Please enter a valid number (0-9)');
      return;
    }

    try {
      const result = await setWingoResult(duration, parseInt(number));
      if (result.success) {
        document.getElementById('override-status').innerHTML = 
          `<div class="success">✅ Result set successfully: ${number}</div>`;
      } else {
        document.getElementById('override-status').innerHTML = 
          `<div class="error">❌ ${result.message}</div>`;
      }
    } catch (error) {
      document.getElementById('override-status').innerHTML = 
        `<div class="error">❌ Error setting result</div>`;
    }
  }

  handleWebSocketMessage(data) {
    if (data.type === 'exposure_update' && data.room === this.currentRoom) {
      this.updateExposureDisplay(data);
    }
  }

  updateExposureDisplay(data) {
    // Update exposure numbers
    Object.keys(data.exposures).forEach(key => {
      const number = key.split(':')[1];
      const element = document.getElementById(`exposure-${data.room}-${number}`);
      if (element) {
        element.textContent = `₹${data.exposures[key]}`;
      }
    });

    // Update analysis
    document.getElementById(`total-exposure-${data.room}`).textContent = 
      `₹${data.analysis.totalExposure}`;
    document.getElementById(`optimal-number-${data.room}`).textContent = 
      data.analysis.optimalNumber;
    document.getElementById(`highest-exposure-${data.room}`).textContent = 
      `₹${data.analysis.highestExposure}`;
  }
}

// Initialize dashboard
const dashboard = new AdminExposureDashboard();
```

## 🎨 CSS Styling

### Step 10: Add Modern Styling
```css
/* Dashboard Styles */
.exposure-dashboard {
  font-family: 'Inter', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
}

.dashboard-header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-selector {
  display: flex;
  gap: 10px;
}

.room-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.room-btn.active {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.exposure-grid {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
}

.exposure-numbers {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 15px;
}

.exposure-number {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 15px;
  text-align: center;
  transition: all 0.3s ease;
}

.exposure-number.optimal {
  background: rgba(34, 197, 94, 0.3);
  border: 2px solid #22c55e;
  transform: scale(1.05);
}

.exposure-number .number {
  font-size: 24px;
  font-weight: bold;
  color: white;
  margin-bottom: 5px;
}

.exposure-number .exposure {
  font-size: 18px;
  color: #fbbf24;
  font-weight: 600;
}

.exposure-number .bet-count {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 5px;
}

.analysis-panel {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.analysis-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.analysis-item label {
  color: #9ca3af;
  font-size: 14px;
}

.analysis-item span {
  color: white;
  font-weight: 600;
}

.analysis-item span.optimal {
  color: #22c55e;
  font-weight: bold;
}

.admin-controls {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 20px;
}

.override-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.override-controls input {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 16px;
}

.override-controls input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.override-btn {
  padding: 10px 20px;
  background: #ef4444;
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.override-btn:hover {
  background: #dc2626;
  transform: scale(1.05);
}

.status-info {
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
}

.status-info .success {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid #22c55e;
}

.status-info .error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid #ef4444;
}
```

## 🔧 Configuration Requirements

### Step 11: Environment Setup
```javascript
// Required environment variables for backend
ADMIN_JWT_SECRET=your_admin_jwt_secret_here
ADMIN_IP_WHITELIST=127.0.0.1,::1,your_admin_ip_here
REDIS_URL=redis://localhost:6379
```

### Step 12: CORS Configuration
```javascript
// Backend CORS setup (if needed)
app.use(cors({
  origin: ['http://localhost:3000', 'http://your-frontend-domain.com'],
  credentials: true
}));
```

## 📋 Integration Checklist

- [ ] ✅ Admin authentication working
- [ ] ✅ JWT token stored in localStorage
- [ ] ✅ REST API endpoints accessible
- [ ] ✅ WebSocket connection established
- [ ] ✅ Real-time updates working
- [ ] ✅ Room switching functional
- [ ] ✅ Exposure display updating
- [ ] ✅ Admin override working
- [ ] ✅ Error handling implemented
- [ ] ✅ Responsive design applied
- [ ] ✅ Security measures in place

## 🚨 Important Notes

1. **IP Whitelisting**: Ensure your frontend server IP is whitelisted
2. **Token Expiry**: Handle JWT token expiration gracefully
3. **WebSocket Reconnection**: Implement automatic reconnection logic
4. **Error Handling**: Always handle API errors and WebSocket disconnections
5. **Security**: Never expose admin tokens in client-side code
6. **Performance**: Implement debouncing for frequent updates
7. **Mobile Responsive**: Ensure dashboard works on mobile devices

## 🆘 Troubleshooting

### Common Issues:
1. **CORS Errors**: Check backend CORS configuration
2. **WebSocket Connection Failed**: Verify WebSocket server is running
3. **Authentication Failed**: Check JWT token and IP whitelist
4. **No Real-time Updates**: Verify WebSocket subscription
5. **Override Not Working**: Check period status and timing

### Debug Commands:
```javascript
// Check WebSocket connection
console.log('WebSocket state:', ws.readyState);

// Check authentication
console.log('Token:', localStorage.getItem('adminToken'));

// Test API endpoint
fetch('/api/admin/exposure/all', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
```

This guide provides everything needed to integrate the frontend with the admin exposure monitoring system. The system supports real-time updates, room switching, admin overrides, and comprehensive error handling. 