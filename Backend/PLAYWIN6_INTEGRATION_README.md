# PlayWin6 Provider Integration

This document describes the integration of the PlayWin6 game provider into the Diuwin backend system.

## Overview

PlayWin6 is a game provider that offers various casino games including slots, live casino, table games, and more. This integration provides a complete API interface for:

- Getting available providers and games
- Launching games with user authentication
- Handling game callbacks and transactions
- Managing game sessions
- Admin operations

## API Endpoints

### Public Endpoints (No Authentication Required)

#### Health Check
```
GET /api/playwin6/health
```
Check if the PlayWin6 service is healthy and properly configured.

#### Get Providers
```
GET /api/playwin6/providers
```
Get all available PlayWin6 providers.

#### Get Provider Games
```
GET /api/playwin6/games/:provider?count=12&type=Slot Game
```
Get games from a specific provider.

**Parameters:**
- `provider` (path): Provider name (e.g., 'JiliGaming')
- `count` (query): Number of games to return (1-100, default: 12)
- `type` (query): Game type filter (e.g., 'Slot Game', 'Live Casino')

#### Callback Handler
```
POST /api/playwin6/callback
```
Handle callbacks from PlayWin6 provider for game transactions.

### Protected Endpoints (Authentication Required)

#### Launch Game
```
POST /api/playwin6/launch
```
Launch a PlayWin6 game for an authenticated user.

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "gameUid": "JiliGaming",
  "walletAmount": 1000,
  "token": "optional_custom_token",
  "additionalData": {
    "language": "en",
    "currency": "INR"
  }
}
```

#### Get User Game History
```
GET /api/playwin6/history?limit=50&offset=0
```
Get the authenticated user's PlayWin6 game history.

**Query Parameters:**
- `limit`: Number of records to return (max 100, default: 50)
- `offset`: Number of records to skip (default: 0)
- `gameUid`: Filter by game provider (optional)
- `startDate`: Start date filter (optional)
- `endDate`: End date filter (optional)

#### Get Game Session
```
GET /api/playwin6/session/:sessionToken
```
Get details of a specific game session.

#### End Game Session
```
POST /api/playwin6/session/:sessionToken/end
```
End a specific game session.

### Admin Endpoints (Admin Authentication Required)

#### Cleanup Expired Sessions
```
POST /api/playwin6/admin/cleanup-sessions
```
Clean up expired PlayWin6 game sessions.

#### Get All Sessions
```
GET /api/playwin6/admin/sessions?limit=50&offset=0&status=launched
```
Get all PlayWin6 game sessions (admin only).

### Debug Endpoints (Development Only)

#### Debug Launch Game
```
POST /api/playwin6/debug/launch
```
Debug endpoint to test game launch without authentication.

#### Debug Get Games
```
GET /api/playwin6/debug/games/:provider?count=5&type=Slot Game
```
Debug endpoint to test provider games.

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# PlayWin6 API Configuration
PLAYWIN6_API_BASE_URL=https://playwin6.com
PLAYWIN6_API_TOKEN=your_api_token_here
PLAYWIN6_GAME_LAUNCH_URL=https://playwin6.com/launchGame
PLAYWIN6_PROVIDER_GAME_URL=https://playwin6.com/providerGame
PLAYWIN6_GET_PROVIDER_URL=https://playwin6.com/getProvider

# Callback URLs
PLAYWIN6_CALLBACK_URL=https://your-domain.com/api/playwin6/callback

# Frontend URLs
FRONTEND_URL=https://your-domain.com

# AES Encryption (Required for payload encryption)
PLAYWIN6_AES_KEY=your_aes_key_here
PLAYWIN6_AES_IV=your_aes_iv_here

# Security
PLAYWIN6_ALLOWED_IPS=127.0.0.1,192.168.1.1
PLAYWIN6_PASSWORD_SALT=your_password_salt_here
```

### Configuration Validation

The system will automatically validate the configuration on startup and log warnings for missing or invalid settings.

## Supported Providers

The integration supports the following game providers:

- JiliGaming
- PragmaticPlay
- EvolutionGaming
- Microgaming
- NetEnt
- Playtech
- Betsoft
- Habanero
- RedTiger
- Quickspin
- Yggdrasil
- PlayStar
- CQ9
- PGSoft
- SpadeGaming
- AsiaGaming
- BoomingGames
- GameArt
- Playson
- Wazdan

## Supported Game Types

- Slot Game
- Live Casino
- Table Games
- Card Games
- Arcade Games
- Fishing Games
- Lottery Games
- Sports Betting

## Security Features

### IP Whitelisting
Configure allowed IP addresses for callback validation.

### AES Encryption
All payloads are encrypted using AES-256-CBC encryption.

### Session Management
Game sessions are tracked with unique tokens and automatic cleanup.

### Input Validation
All inputs are validated for type, format, and security.

## Testing

### Using the Test Script

Run the integration test script:

```bash
node test-playwin6-integration.js
```

This will test:
- Configuration validation
- Health check
- Provider listing
- Game listing
- Game launch
- Callback handling
- API endpoints

### Using Postman

Import the provided Postman collection:
`PlayWin6_API_Tests.postman_collection.json`

Set up the following variables:
- `baseUrl`: Your API server URL
- `authToken`: User authentication token
- `adminAuthToken`: Admin authentication token
- `playwin6Token`: PlayWin6 API token
- `sessionToken`: Game session token

## Database Models

The integration expects the following database models (optional):

### PlayWin6GameSession
```sql
CREATE TABLE playwin6_game_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  gameUid VARCHAR(100) NOT NULL,
  sessionToken VARCHAR(255) UNIQUE NOT NULL,
  launchUrl TEXT NOT NULL,
  walletAmount DECIMAL(10,2) NOT NULL,
  timestamp BIGINT NOT NULL,
  status ENUM('launched', 'ended') DEFAULT 'launched',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  endedAt TIMESTAMP NULL,
  INDEX idx_userId (userId),
  INDEX idx_sessionToken (sessionToken),
  INDEX idx_status (status)
);
```

### PlayWin6Transaction
```sql
CREATE TABLE playwin6_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  gameUid VARCHAR(100) NOT NULL,
  transactionId VARCHAR(255) UNIQUE NOT NULL,
  betAmount DECIMAL(10,2) DEFAULT 0,
  winAmount DECIMAL(10,2) DEFAULT 0,
  walletAmount DECIMAL(10,2) NOT NULL,
  gameResult VARCHAR(50),
  sessionId VARCHAR(255),
  timestamp BIGINT NOT NULL,
  payload JSON,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'completed',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_transactionId (transactionId),
  INDEX idx_gameUid (gameUid)
);
```

## Error Handling

The integration includes comprehensive error handling:

- **Configuration Errors**: Logged with warnings
- **API Errors**: Retried with exponential backoff
- **Validation Errors**: Returned with descriptive messages
- **Database Errors**: Gracefully handled with fallbacks

## Monitoring

### Health Check
Monitor the health endpoint to ensure the service is running:
```
GET /api/playwin6/health
```

### Logs
The integration provides detailed logging for:
- API requests and responses
- Error conditions
- Session management
- Callback processing

### Metrics
Track the following metrics:
- API response times
- Success/failure rates
- Session counts
- Transaction volumes

## Troubleshooting

### Common Issues

1. **API Token Not Configured**
   - Set `PLAYWIN6_API_TOKEN` environment variable

2. **AES Encryption Not Working**
   - Ensure `PLAYWIN6_AES_KEY` and `PLAYWIN6_AES_IV` are set
   - Keys must be 32 bytes for AES-256

3. **Callback Failures**
   - Check IP whitelist configuration
   - Verify callback URL is accessible
   - Ensure payload encryption is working

4. **Game Launch Failures**
   - Verify user exists in database
   - Check wallet amount is valid
   - Ensure provider and game type are supported

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

This will enable additional debug endpoints and detailed logging.

## Integration Flow

1. **User Authentication**: User logs in and gets authentication token
2. **Game Selection**: User selects a game from available providers
3. **Game Launch**: System creates session and generates launch URL
4. **Game Play**: User plays the game on PlayWin6 platform
5. **Callback Processing**: PlayWin6 sends transaction data via callback
6. **Session Management**: System tracks and manages game sessions
7. **History Tracking**: All transactions are logged for user history

## Support

For issues or questions about the PlayWin6 integration:

1. Check the logs for error messages
2. Run the test script to verify functionality
3. Use the health check endpoint to verify service status
4. Review the configuration settings

## Changelog

### Version 1.0.0
- Initial PlayWin6 provider integration
- Support for game listing and launching
- Callback handling and transaction processing
- Session management and cleanup
- Admin endpoints for monitoring
- Comprehensive testing and documentation 