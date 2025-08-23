# Casino API Integration Guide

## Overview

This guide explains how to integrate the new casino API into your existing system. The integration uses **SEAMLESS** mode with your existing third-party wallet system.

## Features

✅ **SEAMLESS Integration** - Direct wallet integration  
✅ **AES-256 Encryption** - Secure payload handling  
✅ **Third-Party Wallet Integration** - Uses your existing wallet system  
✅ **Transaction Tracking** - Complete bet/win history  
✅ **Session Management** - Game session tracking  
✅ **Callback Handling** - Real-time transaction processing  

## Setup Instructions

### 1. Environment Configuration

Add these variables to your `.env` file:

```bash
# Casino API Credentials
CASINO_AGENCY_UID=your_actual_agency_uid
CASINO_AES_KEY=your_actual_aes_key
CASINO_SERVER_URL=https://your_casino_server.com
CASINO_CALLBACK_URL=https://yourdomain.com/api/casino/callback

# Optional Settings
CASINO_DEFAULT_CURRENCY=USD
CASINO_DEFAULT_LANGUAGE=en
CASINO_ENABLE_LOGGING=true
```

### 2. Database Setup

Run the migration to create casino tables:

```bash
npm run migrate
# or
npx sequelize-cli db:migrate
```

### 3. Add Routes to Main App

In your main `app.js` or `index.js`, add:

```javascript
const casinoRoutes = require('./routes/casinoRoutes');

// Add casino routes
app.use('/api/casino', casinoRoutes);
```

### 4. Update Models Index

Ensure the new models are included in your models index file.

## API Endpoints

### Game Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/casino/games` | Get available games |
| `POST` | `/api/casino/games/:gameUid/launch` | Launch a game |

### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/casino/sessions` | Get user sessions |
| `DELETE` | `/api/casino/sessions/:sessionId` | Close game session |

### Transactions & Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/casino/transactions` | Get transaction history |
| `GET` | `/api/casino/stats` | Get user statistics |

### Callback (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/casino/callback` | Casino provider callback |

## Usage Examples

### Launch a Game

```javascript
// Frontend example
const launchGame = async (gameUid) => {
  try {
    const response = await fetch(`/api/casino/games/${gameUid}/launch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Open game in iframe or redirect
      window.open(result.data.gameUrl, '_blank');
    }
  } catch (error) {
    console.error('Failed to launch game:', error);
  }
};
```

### Get Transaction History

```javascript
const getTransactions = async () => {
  try {
    const response = await fetch('/api/casino/transactions?limit=20&offset=0', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    return result.data.transactions;
  } catch (error) {
    console.error('Failed to get transactions:', error);
  }
};
```

## How It Works

### 1. Game Launch Flow

```
User → Launch Game → Check Balance → Call Casino API → Get Game URL → Create Session
```

1. User requests to launch a game
2. System checks third-party wallet balance
3. System calls casino API with encrypted payload
4. Casino returns game launch URL
5. System creates game session record
6. User gets game URL to play

### 2. Transaction Flow

```
Game Action → Casino Callback → Decrypt Payload → Update Wallet → Record Transaction → Encrypt Response
```

1. User places bet/wins in game
2. Casino sends encrypted callback
3. System decrypts and processes transaction
4. System updates third-party wallet balance
5. System records transaction in database
6. System sends encrypted response back to casino

### 3. Balance Management

- **Before Game**: User transfers funds to third-party wallet
- **During Game**: Casino directly debits/credits third-party wallet
- **After Game**: User can transfer remaining balance back to main wallet

## Security Features

- **AES-256 Encryption**: All API payloads are encrypted
- **Timestamp Validation**: Prevents replay attacks
- **Agency UID Validation**: Ensures callbacks are from legitimate source
- **Duplicate Prevention**: Prevents double-processing of transactions
- **Transaction Logging**: Complete audit trail of all operations

## Error Handling

The system handles various error scenarios:

- **Insufficient Balance**: User must transfer funds before playing
- **Invalid Game UID**: Game not found in casino provider
- **Network Errors**: Automatic retry mechanisms
- **Duplicate Transactions**: Idempotent processing
- **Invalid Callbacks**: Secure error responses

## Testing

### Test Encryption

```bash
POST /api/casino/test-encryption
{
  "testData": "Hello World"
}
```

### Health Check

```bash
GET /api/casino/health
```

## Monitoring

### Logs to Watch

- `🎮 === CASINO GAME LAUNCH ===`
- `📞 === CASINO CALLBACK ===`
- `💸 === CASINO BET TRANSACTION ===`
- `💰 === CASINO WIN TRANSACTION ===`

### Key Metrics

- Game launch success rate
- Callback processing time
- Transaction success rate
- Wallet balance accuracy

## Troubleshooting

### Common Issues

1. **"Insufficient balance"**
   - User needs to transfer funds to third-party wallet first
   - Use `/api/third-party-wallet/transfer-to-third-party`

2. **"Game launch failed"**
   - Check casino API credentials
   - Verify server connectivity
   - Check user balance

3. **"Callback processing error"**
   - Verify AES key is correct
   - Check timestamp validation
   - Review callback payload format

### Debug Steps

1. Check environment variables
2. Verify database tables exist
3. Test encryption/decryption
4. Check casino API connectivity
5. Review server logs

## Support

For issues or questions:

1. Check server logs for detailed error messages
2. Verify casino API credentials
3. Test with provided test endpoints
4. Review this integration guide

## Future Enhancements

- [ ] Support for multiple casino providers
- [ ] Advanced game filtering and search
- [ ] Real-time balance updates via WebSocket
- [ ] Admin dashboard for casino management
- [ ] Automated testing suite
