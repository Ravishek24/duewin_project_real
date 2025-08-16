# Valid Referral History API

## Overview
This API provides detailed information about valid referrals for a user, including user details, deposit amounts, and registration dates.

## Endpoint
```
GET /api/referral/valid/history
```

## Authentication
Requires valid JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Query Parameters
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of records per page (default: 10, max: 100)

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "user": {
    "userId": 123,
    "userName": "JohnDoe",
    "totalReferrals": 15,
    "validReferrals": 8
  },
  "summary": {
    "totalValidReferrals": 8,
    "totalRechargeAmount": 4500.00,
    "totalBetAmount": 12000.00,
    "averageRechargePerReferral": 562.50
  },
  "pagination": {
    "currentPage": 1,
    "limit": 10,
    "totalPages": 1,
    "totalItems": 8,
    "hasNextPage": false,
    "hasPrevPage": false
  },
  "history": [
    {
      "referralId": 456,
      "referredUser": {
        "userId": 789,
        "userName": "JaneSmith",
        "email": "jane@example.com",
        "phone": "+1234567890",
        "registrationDate": "2024-01-15T10:30:00.000Z",
        "totalRechargeAmount": 500.00,
        "totalBetAmount": 1500.00
      },
      "validReferralDetails": {
        "totalRecharge": 500.00,
        "isValid": true,
        "validRechargeDate": "2024-01-20T14:45:00.000Z",
        "validRechargeAmount": 300.00,
        "becameValidAt": "2024-01-20T14:45:00.000Z"
      }
    }
  ]
}
```

### Error Response (400/500)
```json
{
  "success": false,
  "message": "Error description"
}
```

## Data Fields Explained

### User Summary
- `userId`: Your user ID
- `userName`: Your username
- `totalReferrals`: Total number of people you've referred
- `validReferrals`: Number of referrals who have recharged ₹300+

### Summary Statistics
- `totalValidReferrals`: Count of valid referrals
- `totalRechargeAmount`: Sum of all recharge amounts from valid referrals
- `totalBetAmount`: Sum of all betting amounts from valid referrals
- `averageRechargePerReferral`: Average recharge per valid referral

### History Records
Each record contains:

#### Referred User Information
- `userId`: Referred user's ID
- `userName`: Referred user's username
- `email`: Referred user's email
- `phone`: Referred user's phone number
- `registrationDate`: When they registered
- `totalRechargeAmount`: Their total recharge amount
- `totalBetAmount`: Their total betting amount

#### Valid Referral Details
- `totalRecharge`: Total amount they've recharged
- `isValid`: Whether they're currently valid (should be true)
- `validRechargeDate`: Date when they crossed ₹300 threshold
- `validRechargeAmount`: The specific recharge amount that made them valid
- `becameValidAt`: When their status was updated to valid

## How Valid Referrals Work

1. **Referral Creation**: When someone registers using your referral code
2. **Recharge Tracking**: System tracks their cumulative recharge amount
3. **Validation Threshold**: Referral becomes "valid" when total recharge ≥ ₹300
4. **Bonus Eligibility**: Valid referrals count toward invitation bonus tiers

## Example Usage

### Get first page of valid referrals
```bash
curl -H "Authorization: Bearer <token>" \
     "https://api.example.com/api/referral/valid/history?page=1&limit=10"
```

### Get second page with 5 records
```bash
curl -H "Authorization: Bearer <token>" \
     "https://api.example.com/api/referral/valid/history?page=2&limit=5"
```

## Testing

Run the test script to verify the API works:
```bash
node Backend/scripts/testValidReferralHistory.js
```

## Notes

- Only shows referrals that have recharged ₹300 or more
- Sorted by most recent valid referrals first
- Includes comprehensive user and financial data
- Supports pagination for large datasets
- Real-time data from ValidReferral and User tables
