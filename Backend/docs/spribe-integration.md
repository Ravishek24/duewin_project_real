# Spribe Integration with Unified Callback

This document explains how the Spribe integration has been updated to use a single unified callback endpoint instead of multiple endpoints for different operations.

## Overview

Previously, the integration with Spribe used multiple callback endpoints:
- Auth callback
- Player info callback
- Withdraw (bet) callback
- Deposit (win) callback
- Rollback callback

The new implementation consolidates all these into a single endpoint:
```
/api/spribe/callback
```

## Security Requirements (Spribe v1.9.0+)

As of Spribe version 1.9.0 (November 11, 2024), all API requests require security validation:

1. **Required Headers**: 
   - `X-Spribe-Client-ID`: The client ID provided by Spribe
   - `X-Spribe-Client-TS`: Current timestamp in seconds 
   - `X-Spribe-Client-Signature`: HMAC-SHA256 signature

2. **Signature Validation**:
   - Each API request must be validated using these headers
   - The signature is validated using the `validateSignature` function in `utils/spribeUtils.js`

3. **Response Status Codes**:
   - Important: HTTP status code should **always be 200** even for errors
   - Error conditions are indicated in the response body with appropriate code values

## How It Works

1. When a player launches a game, we pass the unified callback URL to Spribe
2. Spribe sends all API requests to this single endpoint
3. Each request includes an `action` field that identifies the operation type
4. Our callback handler:
   - Validates the security signature
   - Routes the request to the appropriate service method based on the action type
   - Always returns HTTP 200 with appropriate response codes in the body

## Action Types

The Spribe API uses the following action types:

| Action | Description | Service Method |
|--------|-------------|----------------|
| `auth` | Player authentication | `handleAuth` |
| `player_info` | Retrieve player information | `handlePlayerInfo` |
| `withdraw` | Deduct money from player's wallet (bet) | `handleWithdraw` |
| `deposit` | Add money to player's wallet (win) | `handleDeposit` |
| `rollback` | Reverse a previous transaction | `handleRollback` |

## Currency Handling

Spribe has specific requirements for currency formatting:

- **Fiat currencies**: Use 3 decimal places (multiply by 10^3)
  - Example: 5.32 USD is represented as 5320

- **Crypto currencies**: Use 8 decimal places (multiply by 10^8)
  - Example: 0.0532 BTC is represented as 5320000

## Implementation Details

### Configuration

In `config/spribeConfig.js`:
```javascript
callbackUrl: process.env.SPRIBE_CALLBACK_URL || 'https://yourdomain.com/api/spribe/callback'
```

### Game Launch URL Generation

In `utils/spribeUtils.js`:
```javascript
const params = {
  // ... other parameters
  callback_url: spribeConfig.callbackUrl
};
```

### Callback Handler

In `controllers/spribeController.js`:
```javascript
const handleCallback = async (req, res) => {
  // Validate security signature
  const clientId = req.header('X-Spribe-Client-ID');
  const timestamp = req.header('X-Spribe-Client-TS');
  const signature = req.header('X-Spribe-Client-Signature');
  
  const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
  
  if (!isValidSignature) {
    return res.status(200).json({
      code: 413,
      message: 'Invalid Client-Signature'
    });
  }
  
  const { action } = req.body;
  
  let result;
  switch (action) {
    case 'auth':
      result = await spribeService.handleAuth(req.body);
      break;
    // ... other actions
  }
  
  // Always return HTTP 200 (per Spribe requirements)
  return res.status(200).json(result);
};
```

### Route Registration

In `routes/spribeRoutes.js`:
```javascript
router.post('/callback', handleCallback);
```

## Third-Party Wallet Integration

The Spribe integration has also been updated to use the third-party wallet system:

1. When a player launches a game, their main wallet balance is transferred to the third-party wallet
2. All transactions with Spribe (bets, wins, rollbacks) use the third-party wallet
3. When the player exits the game, the remaining balance is transferred back to the main wallet

## Testing

To test the unified callback:

1. Launch a Spribe game
2. Play the game (place bets, receive wins)
3. Check the logs for callback requests and responses
4. Verify that transactions are processed correctly
5. Verify that the third-party wallet balance updates properly

## Troubleshooting

If you encounter issues with the Spribe integration:

1. Check the server logs for callback requests and responses
2. Verify the security headers and signature validation
3. Ensure that the third-party wallet is being used correctly
4. Check that the response status code is always 200, even for errors 