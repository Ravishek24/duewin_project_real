# Third-Party Games Statistics API Documentation

## Overview

This API provides comprehensive statistics and transaction history for third-party games (Spribe and Seamless) integrated into the platform. The endpoints are optimized for performance with minimal database operations.

## Endpoints

### 1. Get Third-Party Games Statistics

**Endpoint:** `GET /api/users/third-party-games/stats`

**Description:** Retrieves comprehensive statistics for all third-party games (Spribe and Seamless) for the authenticated user.

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `period` (optional): Time period filter
  - Valid values: `'today'`, `'yesterday'`, `'this_week'`, `'this_month'`
  - Default: `'today'`

**Response Structure:**
```json
{
  "success": true,
  "period": "today",
  "date_range": {
    "start_date": "2024-01-01T00:00:00.000Z",
    "end_date": "2024-01-01T23:59:59.999Z"
  },
  "overall_stats": {
    "total_transactions": 150,
    "total_bets": 75,
    "total_wins": 65,
    "total_bet_amount": 5000.00,
    "total_win_amount": 5200.00,
    "net_profit": 200.00,
    "win_rate": 46.67,
    "jackpot_wins": 2,
    "jackpot_amount": 500.00,
    "freeround_bets": 5,
    "freeround_wins": 3
  },
  "game_stats": {
    "spribe": {
      "provider": "Spribe",
      "total_transactions": 80,
      "total_bets": 40,
      "total_wins": 35,
      "total_rollbacks": 5,
      "total_bet_amount": 3000.00,
      "total_win_amount": 3200.00,
      "total_rollback_amount": 100.00,
      "net_profit": 200.00,
      "win_rate": 46.67
    },
    "seamless": {
      "provider": "pf",
      "total_transactions": 70,
      "total_bets": 35,
      "total_wins": 30,
      "total_rollbacks": 3,
      "total_balance_checks": 2,
      "total_bet_amount": 2000.00,
      "total_win_amount": 2000.00,
      "total_rollback_amount": 50.00,
      "jackpot_wins": 2,
      "jackpot_amount": 500.00,
      "freeround_bets": 5,
      "freeround_wins": 3,
      "net_profit": 0.00,
      "win_rate": 46.15
    }
  }
}
```

### 2. Get Third-Party Game History

**Endpoint:** `GET /api/users/third-party-games/:gameType/history`

**Description:** Retrieves detailed transaction history for a specific third-party game type with pagination.

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `gameType` (required): Game type identifier
  - Valid values: `'spribe'`, `'seamless'`

**Query Parameters:**
- `period` (optional): Time period filter
  - Valid values: `'today'`, `'yesterday'`, `'this_week'`, `'this_month'`
  - Default: `'today'`
- `page` (optional): Page number for pagination
  - Default: `1`
  - Must be a positive integer
- `limit` (optional): Number of records per page
  - Default: `20`
  - Must be between 1 and 100

**Response Structure:**
```json
{
  "success": true,
  "game_type": "spribe",
  "provider": "Spribe",
  "period": "today",
  "date_range": {
    "start_date": "2024-01-01T00:00:00.000Z",
    "end_date": "2024-01-01T23:59:59.999Z"
  },
  "pagination": {
    "current_page": 1,
    "total_pages": 8,
    "total_records": 150,
    "records_per_page": 20,
    "has_next_page": true,
    "has_prev_page": false
  },
  "transactions": [
    {
      "transaction_id": "WIN_1704067200000_abc12345",
      "type": "win",
      "amount": 200.00,
      "currency": "USD",
      "game_id": "aviator",
      "provider": "spribe_aviator",
      "provider_tx_id": "spribe_tx_123",
      "status": "completed",
      "created_at": "2024-01-01T10:30:00.000Z",
      "net_profit": 200.00
    }
  ]
}
```

## Data Structure Differences

### Spribe Games
- **Amount Storage:** BIGINT in smallest currency units (cents for USD)
- **Transaction Types:** `'bet'`, `'win'`, `'rollback'`
- **Status Values:** `'completed'` for successful transactions
- **Currency:** USD (stored in cents)
- **Provider:** Always "Spribe"

### Seamless Games
- **Amount Storage:** DECIMAL(15,2) in actual currency units
- **Transaction Types:** `'debit'`, `'credit'`, `'rollback'`, `'balance'`
- **Status Values:** `'success'` for successful transactions
- **Additional Features:** Jackpot wins, free rounds, balance checks
- **Provider:** Extracted from the `provider` field in SeamlessTransaction (e.g., "pf", "pg", etc.)

## Performance Optimizations

1. **Parallel Queries:** Both Spribe and Seamless statistics are fetched simultaneously using `Promise.all()`
2. **Single Aggregation Queries:** Each game type uses one optimized query with SQL aggregations
3. **Selective Field Loading:** Only necessary fields are retrieved from the database
4. **Proper Indexing:** Queries utilize existing indexes on `user_id`, `created_at`, `type`, and `status`
5. **Efficient Date Filtering:** Date ranges are calculated once and reused

## Error Handling

The API includes comprehensive error handling for:
- Invalid period parameters
- Invalid game types
- Database connection issues
- Missing or invalid authentication
- Malformed requests

## Example Usage

### Get Today's Statistics
```bash
curl -X GET "http://localhost:3000/api/users/third-party-games/stats?period=today" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Spribe History for This Week
```bash
curl -X GET "http://localhost:3000/api/users/third-party-games/spribe/history?period=this_week&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Seamless History
```bash
curl -X GET "http://localhost:3000/api/users/third-party-games/seamless/history?period=today&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Testing

Use the provided test script to verify the endpoints:

```bash
node test-third-party-stats.js
```

Make sure to update the `TEST_TOKEN` variable in the test script with a valid authentication token.

## Database Requirements

Ensure the following tables exist with proper indexes:
- `spribe_transactions`
- `seamless_transactions`

Required indexes:
- `user_id`
- `created_at`
- `type`
- `status`
- Composite indexes for optimal query performance 