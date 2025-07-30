# PlayWin6 Callback Integration Guide

This guide explains how the PlayWin6 callback handling system works with the database models and ensures everything functions correctly when receiving callbacks from the provider.

## Table of Contents

1. [Overview](#overview)
2. [Callback Flow](#callback-flow)
3. [Model Integration](#model-integration)
4. [Callback Data Structure](#callback-data-structure)
5. [Database Operations](#database-operations)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Overview

The PlayWin6 callback system is designed to:
- Receive transaction data from PlayWin6 provider
- Validate and process the callback data
- Update both `PlayWin6GameSession` and `PlayWin6Transaction` models
- Maintain data integrity and relationships
- Handle various transaction types (bet, win, balance, completion)

## Callback Flow

### 1. Callback Reception
```
PlayWin6 Provider → POST /api/playwin6/callback → playwin6Routes.js → playwin6Service.handleCallback()
```

### 2. Processing Steps
1. **IP Validation**: Verify callback comes from authorized IP
2. **Data Validation**: Validate required fields and data integrity
3. **User Lookup**: Find user by credentials
4. **Session Management**: Find or create game session
5. **Transaction Processing**: Create transaction record
6. **Session Update**: Update session status if needed
7. **Wallet Integration**: Trigger wallet updates (if applicable)

## Model Integration

### PlayWin6GameSession Model

The callback system interacts with the `PlayWin6GameSession` model in the following ways:

#### Session Creation
```javascript
// When no existing session is found
const gameSession = await PlayWin6GameSession.create({
  user_id: user.user_id,
  game_id: game_id || game_uid,
  provider: provider || 'JiliGaming',
  game_type: 'Slot Game',
  session_token: session_id || generateSessionToken(),
  player_username: user.username,
  currency: getUserCurrency(user),
  language: 'en',
  platform: platform || 'desktop',
  ip_address: ipAddress,
  status: 'active',
  started_at: new Date()
});
```

#### Session Updates
```javascript
// When game is completed
if (game_result === 'completed' || game_result === 'finished') {
  await gameSession.update({
    status: 'ended',
    ended_at: new Date()
  });
}
```

#### Session Lookup
```javascript
// Find existing session by token
const gameSession = await PlayWin6GameSession.findOne({
  where: { session_token: session_id }
});
```

### PlayWin6Transaction Model

The callback system creates transaction records in the `PlayWin6Transaction` model:

#### Transaction Creation
```javascript
const transactionData = {
  user_id: user.user_id,
  session_id: gameSession.id, // Links to session
  type: transactionType, // 'bet', 'win', 'balance'
  amount: parseAmount(win_amount || bet_amount || '0'),
  currency: getUserCurrency(user),
  provider: provider || 'JiliGaming',
  game_id: game_id || game_uid,
  game_uid: game_uid,
  provider_tx_id: transaction_id, // From PlayWin6
  operator_tx_id: operatorTxId, // Our internal ID
  action: action || transactionType,
  action_id: action_id,
  old_balance: parseAmount(old_balance || '0'),
  new_balance: parseAmount(new_balance || wallet_amount || '0'),
  wallet_amount: parseAmount(wallet_amount || '0'),
  status: 'completed',
  platform: platform || 'desktop',
  ip_address: ipAddress,
  callback_data: callbackData, // Raw callback data
  encrypted_payload: payload, // Encrypted payload if any
  timestamp: parseInt(timestamp),
  token: token
};

const transaction = await PlayWin6Transaction.create(transactionData);
```

## Callback Data Structure

### Required Fields
```javascript
{
  user_id: "player1",           // Player identifier
  wallet_amount: "1000.00",     // Current wallet balance
  game_uid: "JiliGaming",       // Game provider
  token: "auth_token",          // Authentication token
  timestamp: "1640995200000"    // Unix timestamp
}
```

### Optional Fields
```javascript
{
  game_id: "slot_game_001",     // Specific game ID
  provider: "JiliGaming",       // Provider name
  transaction_id: "tx_123",     // Transaction ID
  bet_amount: "10.00",          // Bet amount
  win_amount: "0.00",           // Win amount
  game_result: "loss",          // Game result
  session_id: "session_123",    // Session identifier
  action: "bet",                // Action type
  action_id: "action_001",      // Action identifier
  old_balance: "1010.00",       // Previous balance
  new_balance: "1000.00",       // New balance
  platform: "desktop",          // Platform type
  payload: "encrypted_data"     // Encrypted payload
}
```

## Database Operations

### Transaction Types

The system automatically determines transaction types based on callback data:

#### Bet Transaction
```javascript
if (bet_amount && parseFloat(bet_amount) > 0) {
  transactionType = 'bet';
}
```

#### Win Transaction
```javascript
if (win_amount && parseFloat(win_amount) > 0) {
  transactionType = 'win';
}
```

#### Balance Update
```javascript
if (!bet_amount && !win_amount) {
  transactionType = 'balance';
}
```

### Data Relationships

#### Session-Transaction Relationship
```javascript
// Each transaction is linked to a session
transactionData.session_id = gameSession.id;

// Session can have multiple transactions
// Transaction belongs to one session
```

#### User Relationships
```javascript
// Both session and transaction are linked to user
sessionData.user_id = user.user_id;
transactionData.user_id = user.user_id;
```

### Data Integrity

#### Unique Constraints
- `provider_tx_id`: Unique transaction ID from PlayWin6
- `operator_tx_id`: Unique internal transaction ID
- `session_token`: Unique session identifier

#### Foreign Key Constraints
- `user_id` → `users.user_id`
- `session_id` → `playwin6_game_sessions.id`

## Error Handling

### Validation Errors
```javascript
// IP validation
if (!validateIPAddress(ipAddress)) {
  throw new Error(`Unauthorized IP address: ${ipAddress}`);
}

// Required fields validation
const validation = validateCallbackData(callbackData);
if (!validation.valid) {
  throw new Error(`Invalid callback data: ${validation.message}`);
}

// User lookup
if (!user) {
  throw new Error(`User not found for user_id: ${user_id}`);
}
```

### Database Errors
```javascript
try {
  const transaction = await PlayWin6Transaction.create(transactionData);
} catch (error) {
  if (error.name === 'SequelizeUniqueConstraintError') {
    // Handle duplicate transaction
    console.warn('Duplicate transaction detected:', transaction_id);
  } else {
    throw error;
  }
}
```

### Rollback Support
```javascript
// Check if transaction can be rolled back
if (transaction.canRollback()) {
  // Create rollback transaction
  await PlayWin6Transaction.create({
    ...rollbackData,
    type: 'rollback',
    rollback_provider_tx_id: originalTransaction.provider_tx_id
  });
}
```

## Testing

### Running Tests
```bash
# Test callback integration
node test-playwin6-callback-integration.js

# Test basic integration
node test-playwin6-integration.js

# Test specific scenarios
npm test -- --grep "PlayWin6"
```

### Test Scenarios

#### 1. Bet Transaction
```javascript
{
  user_id: "player1",
  bet_amount: "10.00",
  win_amount: "0.00",
  game_result: "loss",
  // ... other fields
}
```

#### 2. Win Transaction
```javascript
{
  user_id: "player1",
  bet_amount: "0.00",
  win_amount: "50.00",
  game_result: "win",
  // ... other fields
}
```

#### 3. Balance Update
```javascript
{
  user_id: "player1",
  bet_amount: "0.00",
  win_amount: "0.00",
  game_result: "balance_update",
  // ... other fields
}
```

#### 4. Game Completion
```javascript
{
  user_id: "player1",
  game_result: "completed",
  // ... other fields
}
```

### Verification Commands

#### Check Database Records
```sql
-- Check sessions
SELECT * FROM playwin6_game_sessions ORDER BY created_at DESC LIMIT 10;

-- Check transactions
SELECT * FROM playwin6_transactions ORDER BY created_at DESC LIMIT 10;

-- Check relationships
SELECT 
  s.id as session_id,
  s.session_token,
  s.status as session_status,
  t.id as transaction_id,
  t.type as transaction_type,
  t.amount,
  t.status as transaction_status
FROM playwin6_game_sessions s
LEFT JOIN playwin6_transactions t ON s.id = t.session_id
ORDER BY s.created_at DESC LIMIT 10;
```

#### Check Model Associations
```javascript
// Test session with transactions
const session = await PlayWin6GameSession.findOne({
  include: [PlayWin6Transaction]
});

// Test transaction with session
const transaction = await PlayWin6Transaction.findOne({
  include: [PlayWin6GameSession]
});
```

## Troubleshooting

### Common Issues

#### 1. User Not Found
**Problem**: `User not found for user_id: player1`
**Solution**: Ensure user exists in database and credentials are correct

#### 2. Invalid IP Address
**Problem**: `Unauthorized IP address: 192.168.1.1`
**Solution**: Add IP to whitelist in `playwin6Config.js`

#### 3. Missing Required Fields
**Problem**: `Missing required fields: user_id, wallet_amount`
**Solution**: Check callback data structure from provider

#### 4. Database Constraint Errors
**Problem**: `SequelizeUniqueConstraintError`
**Solution**: Check for duplicate transactions or session tokens

#### 5. Model Not Initialized
**Problem**: `Required PlayWin6 models not loaded`
**Solution**: Ensure models are properly registered in `models/index.js`

### Debug Commands

#### Enable Detailed Logging
```javascript
// In playwin6Service.js
console.log('🎮 Processing PlayWin6 callback:', { callbackData, ipAddress });
console.log('✅ PlayWin6 callback processed successfully');
```

#### Check Model Status
```javascript
// Verify models are loaded
const { getModels } = require('./models');
const models = await getModels();
console.log('Available models:', Object.keys(models));
```

#### Test Individual Components
```javascript
// Test validation
const validation = validateCallbackData(callbackData);
console.log('Validation result:', validation);

// Test user lookup
const user = await User.findOne({ where: { user_id: 1 } });
console.log('User found:', !!user);
```

### Monitoring

#### Health Check
```bash
# Check service health
curl -X GET http://localhost:8000/api/playwin6/health

# Check database connectivity
curl -X GET http://localhost:8000/api/playwin6/admin/health
```

#### Log Monitoring
```bash
# Monitor callback logs
tail -f logs/playwin6-callbacks.log

# Monitor database operations
tail -f logs/database.log
```

## Integration Checklist

- [ ] Database tables created (`playwin6_game_sessions`, `playwin6_transactions`)
- [ ] Models registered in `models/index.js`
- [ ] Routes configured in `routes/index.js`
- [ ] Service functions implemented in `playwin6Service.js`
- [ ] Configuration set in `playwin6Config.js`
- [ ] IP whitelist configured
- [ ] Callback URL accessible
- [ ] Tests passing
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Monitoring set up

## Conclusion

The PlayWin6 callback integration ensures that:

1. **Data Integrity**: All callback data is properly validated and stored
2. **Model Relationships**: Sessions and transactions are correctly linked
3. **Error Handling**: Robust error handling for various scenarios
4. **Testing**: Comprehensive test coverage for all scenarios
5. **Monitoring**: Proper logging and health checks
6. **Maintenance**: Cleanup and maintenance functions

The system is designed to handle real-world scenarios and maintain data consistency across all operations. 