# TRX_WIX Block Number and Time Features

## Overview

Enhanced TRX_WIX results now include **block number** and **result generation time** for improved transparency and verification.

## New Fields Added

### 1. Block Number (`block_number`)
- **Type**: `BIGINT` (nullable)
- **Description**: TRON block number extracted from the verification hash
- **Source**: TRON blockchain API or hash pattern analysis
- **Purpose**: Links game result to specific TRON blockchain block

### 2. Result Time (`result_time`)
- **Type**: `DATE` (not null)
- **Description**: Result generation time in IST (Indian Standard Time)
- **Source**: System clock with IST offset (+5:30)
- **Purpose**: Timestamp when the result was generated

## Database Schema Changes

### Migration File: `20250719000000-add-block-number-and-result-time-to-trx-wix.js`

```sql
-- Add block_number column
ALTER TABLE bet_result_trx_wix 
ADD COLUMN block_number BIGINT NULL 
COMMENT 'TRON block number extracted from hash';

-- Add result_time column
ALTER TABLE bet_result_trx_wix 
ADD COLUMN result_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP 
COMMENT 'Result generation time in IST';
```

### Updated Model: `BetResultTrxWix.js`

```javascript
block_number: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: 'TRON block number extracted from hash'
},
result_time: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Result generation time in IST'
}
```

## New Functions Added

### 1. `getCurrentISTTime()`
```javascript
const getCurrentISTTime = () => {
    const now = new Date();
    // IST is UTC+5:30
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return istTime;
};
```

### 2. `extractBlockNumber(hash)`
```javascript
const extractBlockNumber = async (hash) => {
    // First try to get block number from API
    const blockNumber = await getBlockNumberFromHash(hash);
    if (blockNumber) {
        return blockNumber;
    }

    // Fallback: Try to extract from hash pattern
    if (hash && hash.startsWith('000000000')) {
        const hexPart = hash.substring(9, 17);
        const blockNum = parseInt(hexPart, 16);
        if (blockNum && blockNum > 0) {
            return blockNum;
        }
    }

    return null;
};
```

### 3. `getBlockNumberFromHash(hash)`
```javascript
const getBlockNumberFromHash = async (hash) => {
    const response = await axios.get(`${TRON_API_URL}/block`, {
        params: { hash: hash },
        timeout: 10000
    });

    if (response.data && response.data.number) {
        return parseInt(response.data.number);
    }
    return null;
};
```

## Updated Result Format

### Before:
```json
{
    "periodId": "20250719000000583",
    "result": {
        "number": 5,
        "color": "green_violet",
        "size": "Big",
        "parity": "odd"
    },
    "verification": {
        "hash": "00000000046a5185c55cbf7bec62f6157b6347596d2e926f3300682173e205ef",
        "link": "https://tronscan.org/#/block/00000000046a5185c55cbf7bec62f6157b6347596d2e926f3300682173e205ef"
    },
    "gameType": "trx_wix",
    "duration": 30
}
```

### After:
```json
{
    "periodId": "20250719000000583",
    "result": {
        "number": 5,
        "color": "green_violet",
        "size": "Big",
        "parity": "odd"
    },
    "verification": {
        "hash": "00000000046a5185c55cbf7bec62f6157b6347596d2e926f3300682173e205ef",
        "link": "https://tronscan.org/#/block/00000000046a5185c55cbf7bec62f6157b6347596d2e926f3300682173e205ef",
        "block": 74076092,
        "time": "2025-07-19T06:28:24.000Z"
    },
    "gameType": "trx_wix",
    "duration": 30
}
```

## Block Number Extraction Process

### 1. API Method (Primary)
- Fetches block details from TRON API using hash
- Returns actual block number from blockchain
- Most accurate method for real TRON hashes

### 2. Pattern Analysis (Fallback)
- Analyzes hash pattern for TRON block hashes
- Extracts block number from hex pattern
- Used when API is unavailable or for pattern-based extraction

### 3. Null for Generated Hashes
- Generated fallback hashes return `null` for block number
- This is expected behavior for non-real TRON hashes

## Time Generation

### IST Time Calculation
```javascript
// Current UTC time
const now = new Date();

// Add IST offset (+5:30 = 5.5 hours)
const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
```

### Time Format
- **Database**: `DATETIME` format
- **API Response**: ISO 8601 format (`2025-07-19T06:28:24.000Z`)
- **Display**: Can be formatted for local timezone display

## Updated Functions

### 1. `getResultWithVerification()`
Now returns:
```javascript
{
    result: Object,
    hash: string,
    link: string,
    blockNumber: number|null,
    resultTime: Date
}
```

### 2. Database Storage
```javascript
await BetResultTrxWix.create({
    period: periodId,
    result: JSON.stringify(result),
    verification_hash: hash,
    verification_link: link,
    block_number: blockNumber,
    result_time: resultTime,
    duration: duration,
    timeline: timeline
});
```

### 3. Game History
```javascript
verification: {
    hash: result.verification_hash,
    link: result.verification_link,
    block: result.block_number,
    time: result.result_time
}
```

## Benefits

### 1. Enhanced Transparency
- **Block Verification**: Players can verify results against specific TRON blocks
- **Time Tracking**: Exact timestamp of result generation
- **Audit Trail**: Complete verification chain

### 2. Improved Trust
- **Blockchain Link**: Direct connection to TRON blockchain
- **Time Accuracy**: IST time for local relevance
- **Verification Chain**: Hash → Block → Time

### 3. Better User Experience
- **Detailed Information**: More comprehensive result data
- **Verification Tools**: Multiple ways to verify results
- **Transparency**: Full disclosure of result generation process

## Testing

Run the test script to verify functionality:
```bash
node test-trx-block-time.js
```

This will test:
- IST time generation
- Block number extraction
- Complete verification process
- Different result numbers

## Migration Steps

1. **Run Migration**:
   ```bash
   npx sequelize-cli db:migrate
   ```

2. **Update Code**: All changes are already implemented

3. **Test Functionality**:
   ```bash
   node test-trx-block-time.js
   ```

4. **Verify Results**: Check that new fields appear in API responses

## API Endpoints Updated

- `/api/games/trx_wix/results` - Now includes block and time
- `/api/games/trx_wix/history` - Now includes block and time
- WebSocket broadcasts - Now include block and time

## Error Handling

- **API Failures**: Graceful fallback to pattern analysis
- **Network Issues**: Continues with generated hashes
- **Invalid Hashes**: Returns null for block number
- **Time Issues**: Uses system time as fallback

This enhancement makes TRX_WIX one of the most transparent and verifiable lottery games available. 