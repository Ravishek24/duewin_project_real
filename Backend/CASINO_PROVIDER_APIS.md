# 🎰 Casino Provider APIs Documentation

## Overview
This document describes the two new casino provider APIs that allow you to:
1. **Get all available casino providers**
2. **Get games filtered by specific provider**

## 🔐 Authentication
All endpoints require authentication. Include your Bearer token in the Authorization header:
```
Authorization: Bearer your-auth-token-here
```

---

## 📋 API 1: Get All Providers

### Endpoint
```
GET /api/casino/providers
```

### Description
Retrieves a comprehensive list of all available casino game providers.

### Request
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`

### Response
```json
{
  "success": true,
  "data": {
    "providers": [
      "Amatic",
      "Betsoft",
      "Big Time Gaming",
      "Blueprint Gaming",
      "ELK Studios",
      "Endorphina",
      "Evolution Gaming",
      "Evolution Gaming Live",
      "Habanero",
      "Microgaming",
      "NetEnt",
      "NetEnt Live",
      "Play'n GO",
      "PlayStar",
      "Playtech",
      "Pragmatic Play",
      "Pragmatic Play Live",
      "Push Gaming",
      "Quickspin",
      "Red Tiger",
      "Relax Gaming",
      "Thunderkick",
      "Tom Horn",
      "Wazdan",
      "Yggdrasil"
    ],
    "total": 25,
    "source": "fallback_generation",
    "message": "Providers generated as fallback - Real API should provide actual provider list"
  }
}
```

### Response Fields
- **success**: Boolean indicating if the request was successful
- **data.providers**: Array of provider names (alphabetically sorted)
- **data.total**: Total number of providers
- **data.source**: Source of data (`casino_api` or `fallback_generation`)
- **data.message**: Description of the response

---

## 🎮 API 2: Get Games by Provider

### Endpoint
```
GET /api/casino/games?provider={provider_name}
```

### Description
Retrieves all games from a specific casino provider. This endpoint supports multiple filter combinations.

### Request Parameters
- **provider** (optional): Filter games by specific provider name
- **category** (optional): Filter games by category (`slots`, `table`, `live`, `arcade`)
- **search** (optional): Search games by name or category

### Request Examples

#### Get all games from Pragmatic Play:
```
GET /api/casino/games?provider=Pragmatic Play
```

#### Get slot games from Pragmatic Play:
```
GET /api/casino/games?provider=Pragmatic Play&category=slots
```

#### Get live games from Evolution Gaming:
```
GET /api/casino/games?provider=Evolution Gaming&category=live
```

#### Search for Dragon-themed games:
```
GET /api/casino/games?search=Dragon
```

#### Combine multiple filters:
```
GET /api/casino/games?provider=Pragmatic Play&category=slots&search=Fortune
```

### Response
```json
{
  "success": true,
  "data": {
    "games": [
      {
        "game_uid": "slot_000001",
        "name": "Fortune Dragon Mega",
        "category": "slots",
        "provider": "Pragmatic Play",
        "min_bet": 1,
        "max_bet": 75000,
        "currency": "INR"
      },
      {
        "game_uid": "slot_000002",
        "name": "Golden Tiger Ultra",
        "category": "slots",
        "provider": "Pragmatic Play",
        "min_bet": 1,
        "max_bet": 82000,
        "currency": "INR"
      }
    ],
    "total": 2,
    "source": "fallback_generation",
    "message": "Games generated as fallback (TRULY UNLIMITED - NO ARTIFICIAL LIMITS) - Real API should provide unlimited games"
  }
}
```

### Response Fields
- **success**: Boolean indicating if the request was successful
- **data.games**: Array of game objects
- **data.total**: Total number of games matching the filters
- **data.source**: Source of data (`casino_api` or `fallback_generation`)
- **data.message**: Description of the response

### Game Object Fields
- **game_uid**: Unique identifier for the game
- **name**: Game name
- **category**: Game category (`slots`, `table`, `live`, `arcade`)
- **provider**: Casino provider name
- **min_bet**: Minimum bet amount in INR
- **max_bet**: Maximum bet amount in INR
- **currency**: Currency code (always "INR")

---

## 🔍 Advanced Filtering Examples

### 1. Get All Slot Games
```
GET /api/casino/games?category=slots
```

### 2. Get All Table Games from Evolution Gaming
```
GET /api/casino/games?provider=Evolution Gaming&category=table
```

### 3. Search for Live Blackjack Games
```
GET /api/casino/games?category=live&search=Blackjack
```

### 4. Get Arcade Games from Multiple Providers
```
GET /api/casino/games?category=arcade&provider=Pragmatic Play
```

### 5. Search for Games with "Royal" in the Name
```
GET /api/casino/games?search=Royal
```

---

## 📊 Available Categories

1. **slots** - Slot machine games
2. **table** - Table games (Blackjack, Roulette, Poker, etc.)
3. **live** - Live dealer games
4. **arcade** - Arcade-style games (Crash, Dice, Plinko, etc.)

---

## 🏢 Available Providers

The system includes major casino providers such as:
- **Pragmatic Play** - Leading slot provider
- **Evolution Gaming** - Premier live casino provider
- **NetEnt** - High-quality slot games
- **Microgaming** - Classic casino games
- **Playtech** - Diverse game portfolio
- **Betsoft** - 3D slot games
- **Quickspin** - Innovative slot mechanics
- **Yggdrasil** - Creative game designs
- **Play'n GO** - Mobile-optimized games
- **Red Tiger** - Daily drop games
- And many more...

---

## ⚡ Performance Notes

- **Real API Priority**: The system first attempts to get data from the actual casino provider API
- **Fallback Generation**: If the real API fails, it generates comprehensive fallback data
- **No Artificial Limits**: The fallback system generates truly unlimited games (100,000+ slots, 50,000+ table games, etc.)
- **Filtering**: All filtering is done server-side for optimal performance
- **Currency**: All games are configured for INR (Indian Rupees)

---

## 🧪 Testing

Use the provided test script to verify the APIs:
```bash
cd Backend
node test-provider-apis.js
```

**Note**: Update the `AUTH_TOKEN` in the test script with your actual authentication token.

---

## 🚨 Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid parameters",
  "error": "Provider name is required"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to get provider list",
  "error": "Database connection failed"
}
```

---

## 📝 Implementation Notes

- **Encryption**: All real API calls use AES-256 encryption as per casino provider requirements
- **Fallback System**: Comprehensive fallback ensures the system always returns data
- **Scalability**: Designed to handle unlimited game generation without performance issues
- **Currency Support**: Currently configured for INR, easily extensible to other currencies
- **Provider Updates**: Provider list can be updated in the casino service configuration

---

## 🔗 Related Endpoints

- **Game Launch**: `POST /api/casino/games/:gameUid/launch`
- **User Sessions**: `GET /api/casino/sessions`
- **User Transactions**: `GET /api/casino/transactions`
- **User Stats**: `GET /api/casino/stats`
- **Health Check**: `GET /api/casino/health`

---

## 📞 Support

For technical support or questions about these APIs, please refer to the main casino integration documentation or contact the development team.
