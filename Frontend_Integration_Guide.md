# Enhanced Wingo Exposure Tracking - Frontend Integration Guide

## Overview
The enhanced exposure tracking system now provides detailed user information for each number in Wingo games, including user details, bet amounts, and statistics. This guide will help your frontend developer integrate with the new features.

## 🚀 New Features Available

### 1. Enhanced Exposure Data Structure
```javascript
{
  // Backward compatible exposure data
  "success": true,
  "room": "wingo-30s",
  "duration": 30,
  "periodId": "20241201T143000",
  "timestamp": "2024-12-01T14:30:00.000Z",
  "exposures": {
    "number:0": "45.00",
    "number:1": "32.00",
    // ... numbers 2-9
  },
  "analysis": {
    "totalExposure": "1250.75",
    "optimalNumber": 3,
    "zeroExposureNumbers": [7, 8],
    "highestExposure": "300.00",
    "minExposure": "0.00",
    "betDistribution": {
      "totalBets": 15,
      "uniqueUsers": 8,
      "betTypes": { "COLOR": 5, "NUMBER": 3, "SIZE": 4, "PARITY": 3 }
    }
  },
  "periodInfo": {
    "startTime": "2024-12-01T14:30:00.000Z",
    "endTime": "2024-12-01T14:30:30.000Z",
    "timeRemaining": 15,
    "duration": 30
  },
  
  // NEW: Enhanced exposure data with user tracking
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
    ],
    "1": [
      { userId: "user789", betAmount: 12.50, betType: "SIZE", betValue: "big", timestamp: 1703123456791 }
    ]
  },
  
  // Statistics for each number
  "statistics": {
    "number:0": { totalUsers: 2, totalBetAmount: 35.00, uniqueUsers: 2, betTypes: { "COLOR": 1, "NUMBER": 1 } },
    "number:1": { totalUsers: 1, totalBetAmount: 12.50, uniqueUsers: 1, betTypes: { "SIZE": 1 } }
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

### 2. Duration-Specific Data
- **4 Wingo Durations**: 30s, 1m, 3m, 5m
- Each duration has its own exposure data and user tracking
- WebSocket rooms are duration-specific

## 📡 WebSocket Integration

### Connection Setup
```javascript
import { io } from 'socket.io-client';

// Connect to admin namespace
const socket = io('http://your-backend-url/admin', {
  auth: {
    token: 'your-admin-jwt-token'
  }
});

// Listen for connection
socket.on('connect', () => {
  console.log('Connected to admin exposure service');
});

socket.on('disconnect', () => {
  console.log('Disconnected from admin exposure service');
});
```

### Subscribe to Wingo Exposure Updates
```javascript
// Subscribe to specific duration
socket.emit('subscribeToWingoExposure', { duration: 30 }); // 30s
socket.emit('subscribeToWingoExposure', { duration: 60 }); // 1m
socket.emit('subscribeToWingoExposure', { duration: 180 }); // 3m
socket.emit('subscribeToWingoExposure', { duration: 300 }); // 5m

// Listen for exposure updates
socket.on('wingoExposureUpdate', (data) => {
  console.log('Enhanced exposure data:', data);
  updateExposureUI(data);
});

// Listen for all rooms update (every 2.5 seconds)
socket.on('allWingoRoomsUpdate', (data) => {
  console.log('All rooms exposure data:', data);
  updateAllRoomsUI(data);
});
```

### Request User Details for Specific Number
```javascript
// Request detailed user information for a specific number
socket.emit('getUserDetailsForNumber', {
  duration: 30,
  number: 5
});

// Listen for user details response
socket.on('userDetailsForNumber', (data) => {
  console.log('User details for number 5:', data);
  showUserDetailsModal(data);
});
```

## 🎨 UI Implementation Examples

### 1. Enhanced Exposure Display
```javascript
function updateExposureUI(data) {
  const { numbers, userDetails, statistics, periodSummary } = data;
  
  // Update number exposure with user count
  Object.entries(numbers).forEach(([number, exposureData]) => {
    const numberElement = document.getElementById(`number-${number}`);
    if (numberElement) {
      numberElement.innerHTML = `
        <div class="exposure-amount">₹${(exposureData.amount / 100).toFixed(2)}</div>
        <div class="user-count">👥 ${exposureData.users} users</div>
        <div class="total-bet">💰 ₹${exposureData.totalBetAmount.toFixed(2)}</div>
      `;
    }
  });
  
  // Update period summary
  updatePeriodSummary(periodSummary);
}
```

### 2. User Details Modal
```javascript
function showUserDetailsModal(data) {
  const { number, users, statistics } = data;
  
  const modal = document.getElementById('userDetailsModal');
  const modalContent = `
    <div class="modal-header">
      <h3>Number ${number} - User Details</h3>
      <span class="close">&times;</span>
    </div>
    <div class="modal-body">
      <div class="statistics">
        <div class="stat-item">
          <span class="label">Total Users:</span>
          <span class="value">${statistics.totalUsers}</span>
        </div>
        <div class="stat-item">
          <span class="label">Total Bet Amount:</span>
          <span class="value">₹${statistics.totalBetAmount.toFixed(2)}</span>
        </div>
        <div class="stat-item">
          <span class="label">Unique Users:</span>
          <span class="value">${statistics.uniqueUsers}</span>
        </div>
      </div>
      
      <div class="user-list">
        <h4>User Bets</h4>
        ${users.map(user => `
          <div class="user-bet">
            <div class="user-info">
              <span class="user-id">${user.userId}</span>
              <span class="bet-amount">₹${user.betAmount.toFixed(2)}</span>
            </div>
            <div class="bet-details">
              <span class="bet-type">${user.betType}</span>
              <span class="bet-value">${user.betValue}</span>
              <span class="timestamp">${new Date(user.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  modal.innerHTML = modalContent;
  modal.style.display = 'block';
}
```

### 3. Duration Tabs
```javascript
function createDurationTabs() {
  const durations = [30, 60, 180, 300];
  const tabContainer = document.getElementById('duration-tabs');
  
  tabContainer.innerHTML = durations.map(duration => `
    <button class="duration-tab ${duration === 30 ? 'active' : ''}" 
            onclick="switchDuration(${duration})">
      ${duration}s
    </button>
  `).join('');
}

function switchDuration(duration) {
  // Update active tab
  document.querySelectorAll('.duration-tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
  
  // Subscribe to new duration
  socket.emit('subscribeToWingoExposure', { duration });
  
  // Clear current data
  clearExposureData();
}
```

## 🎯 Complete Frontend Example

### HTML Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Wingo Exposure Dashboard</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Enhanced Wingo Exposure Dashboard</h1>
            <div id="connection-status" class="status-indicator">Connecting...</div>
        </header>
        
        <div id="duration-tabs" class="duration-tabs"></div>
        
        <div class="exposure-grid">
            <div id="numbers-container" class="numbers-grid"></div>
            <div id="period-summary" class="period-summary"></div>
        </div>
        
        <div id="userDetailsModal" class="modal"></div>
    </div>
    
    <script src="exposure-dashboard.js"></script>
</body>
</html>
```

### JavaScript Implementation
```javascript
// exposure-dashboard.js
class EnhancedExposureDashboard {
    constructor() {
        this.socket = null;
        this.currentDuration = 30;
        this.exposureData = {};
        this.init();
    }
    
    init() {
        this.connectWebSocket();
        this.createDurationTabs();
        this.createNumbersGrid();
        this.setupEventListeners();
    }
    
    connectWebSocket() {
        this.socket = io('http://your-backend-url/admin', {
            auth: { token: 'your-admin-jwt-token' }
        });
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus('Connected', 'success');
            this.subscribeToCurrentDuration();
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('Disconnected', 'error');
        });
        
        this.socket.on('wingoExposureUpdate', (data) => {
            this.updateExposureData(data);
        });
        
        this.socket.on('userDetailsForNumber', (data) => {
            this.showUserDetailsModal(data);
        });
    }
    
    subscribeToCurrentDuration() {
        this.socket.emit('subscribeToWingoExposure', { duration: this.currentDuration });
    }
    
    updateExposureData(data) {
        this.exposureData = data;
        this.renderNumbers();
        this.renderPeriodSummary();
    }
    
    renderNumbers() {
        const container = document.getElementById('numbers-container');
        const { numbers } = this.exposureData;
        
        container.innerHTML = Object.entries(numbers).map(([number, data]) => `
            <div class="number-card" onclick="dashboard.showUserDetails(${number})">
                <div class="number-header">
                    <span class="number">${number}</span>
                    <span class="user-count">👥 ${data.users}</span>
                </div>
                <div class="exposure-amount">₹${(data.amount / 100).toFixed(2)}</div>
                <div class="total-bet">💰 ₹${data.totalBetAmount.toFixed(2)}</div>
            </div>
        `).join('');
    }
    
    renderPeriodSummary() {
        const { periodSummary } = this.exposureData;
        const container = document.getElementById('period-summary');
        
        container.innerHTML = `
            <h3>Period Summary</h3>
            <div class="summary-stats">
                <div class="stat">
                    <span class="label">Total Users:</span>
                    <span class="value">${periodSummary.totalUsers}</span>
                </div>
                <div class="stat">
                    <span class="label">Total Bet Amount:</span>
                    <span class="value">₹${periodSummary.totalBetAmount.toFixed(2)}</span>
                </div>
                <div class="stat">
                    <span class="label">Unique Users:</span>
                    <span class="value">${periodSummary.uniqueUsers}</span>
                </div>
                <div class="stat">
                    <span class="label">Total Bets:</span>
                    <span class="value">${periodSummary.totalBets}</span>
                </div>
            </div>
        `;
    }
    
    showUserDetails(number) {
        this.socket.emit('getUserDetailsForNumber', {
            duration: this.currentDuration,
            number: number
        });
    }
    
    showUserDetailsModal(data) {
        // Implementation of user details modal
        // (as shown in the previous example)
    }
    
    switchDuration(duration) {
        this.currentDuration = duration;
        this.subscribeToCurrentDuration();
        this.clearData();
    }
    
    updateConnectionStatus(status, type) {
        const indicator = document.getElementById('connection-status');
        indicator.textContent = status;
        indicator.className = `status-indicator ${type}`;
    }
}

// Initialize dashboard
const dashboard = new EnhancedExposureDashboard();
```

## 🎨 CSS Styling
```css
/* styles.css */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.duration-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.duration-tab {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    background: #f0f0f0;
}

.duration-tab.active {
    background: #007bff;
    color: white;
}

.numbers-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 15px;
    margin-bottom: 30px;
}

.number-card {
    background: white;
    border: 1px solid #ddd;
    border-radius: 10px;
    padding: 15px;
    text-align: center;
    cursor: pointer;
    transition: transform 0.2s;
}

.number-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.exposure-amount {
    font-size: 1.2em;
    font-weight: bold;
    color: #007bff;
}

.user-count {
    font-size: 0.9em;
    color: #666;
}

.total-bet {
    font-size: 0.8em;
    color: #28a745;
}

.status-indicator {
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 0.9em;
}

.status-indicator.success {
    background: #d4edda;
    color: #155724;
}

.status-indicator.error {
    background: #f8d7da;
    color: #721c24;
}
```

## 📋 Integration Checklist

### Backend Requirements
- [ ] Enhanced exposure tracking is implemented
- [ ] WebSocket endpoints are working
- [ ] Admin authentication is set up
- [ ] Duration-specific data is properly segregated

### Frontend Implementation
- [ ] WebSocket connection established
- [ ] Duration tabs implemented
- [ ] Enhanced exposure display working
- [ ] User details modal implemented
- [ ] Real-time updates working
- [ ] Error handling implemented
- [ ] Responsive design implemented

### Testing
- [ ] Test with different durations
- [ ] Test user details modal
- [ ] Test real-time updates
- [ ] Test connection handling
- [ ] Test with multiple users

## 🔧 API Endpoints Summary

### WebSocket Events
- `subscribeToWingoExposure` - Subscribe to duration-specific exposure
- `getUserDetailsForNumber` - Get user details for specific number
- `wingoExposureUpdate` - Real-time exposure updates
- `userDetailsForNumber` - User details response
- `allWingoRoomsUpdate` - All rooms summary update

### Data Structure
- Enhanced exposure data with user tracking
- Duration-specific segregation
- Real-time statistics
- User bet details

This guide provides everything your frontend developer needs to integrate with the enhanced exposure tracking system. The implementation is backward compatible and provides rich user interaction capabilities. 