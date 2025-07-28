# User Threshold Implementation

## Overview

The user threshold system has been updated to support different thresholds for different game types. This allows for more granular control over when protection mechanisms activate based on the number of unique users in a game period.

## Implementation Details

### Game-Specific Thresholds

| Game Type | Threshold | Protection Behavior |
|-----------|-----------|-------------------|
| **5D** | 50,000 | Protection triggers when unique users < 50,000 |
| **All Other Games** (Wingo, K3, TRX_WIX, etc.) | 2 | Protection triggers when unique users < 2 |

### Key Functions

#### `getUserThreshold(gameType)`
- **Location**: `Backend/services/gameLogicService.js` (lines 29-40)
- **Purpose**: Returns the appropriate threshold based on game type
- **Parameters**: 
  - `gameType` (string): The game type identifier
- **Returns**: 
  - `50000` for 5D games
  - `2` for all other games
- **Features**:
  - Case insensitive: `'5d'`, `'5D'`, `'FIVED'` all return 50000
  - Null/undefined safe: defaults to 2 for other games

### Updated Functions

The following functions now use the dynamic threshold system:

1. **`getOptimal5DResultByExposure`** (line 1310)
   - Uses `getUserThreshold('5d')` for 5D-specific protection logic

2. **`calculateResultWithVerification`** (line 2764)
   - Uses `getUserThreshold(gameType)` for all game types
   - Determines whether to use protected result selection

3. **`getUniqueUserCount`** (line 3434)
   - Returns threshold in result object based on game type
   - Calculates `meetsThreshold` using dynamic threshold

### Protection Logic

#### For 5D Games (Threshold: 50,000)
- **High threshold** means protection rarely triggers
- Protection only activates when there are fewer than 50,000 unique users
- This allows 5D games to operate normally with large user bases
- Protection may trigger during low-traffic periods or maintenance

#### For Other Games (Threshold: 2)
- **Low threshold** means protection often triggers
- Protection activates when there are fewer than 2 unique users
- This ensures fair play and prevents manipulation in low-user scenarios
- Common in single-user testing or low-traffic periods

### Backward Compatibility

- The old `ENHANCED_USER_THRESHOLD` constant (value: 2) is maintained for backward compatibility
- All existing code continues to work without modification
- New code can use `getUserThreshold(gameType)` for game-specific thresholds

### Testing

A comprehensive test suite has been created in `Backend/test-user-threshold-fix.js` that verifies:

1. ✅ 5D games return threshold of 50,000
2. ✅ Other games return threshold of 2
3. ✅ Case insensitivity works correctly
4. ✅ Null/undefined handling defaults to 2
5. ✅ Protection logic works correctly for various user counts

### Usage Examples

```javascript
const gameLogicService = require('./services/gameLogicService');

// Get thresholds
const threshold5D = gameLogicService.getUserThreshold('5d');        // Returns 50000
const thresholdWingo = gameLogicService.getUserThreshold('wingo');  // Returns 2
const thresholdK3 = gameLogicService.getUserThreshold('k3');        // Returns 2

// Check if protection should activate
const userCount = 1000;
const gameType = '5d';
const threshold = gameLogicService.getUserThreshold(gameType);
const shouldProtect = userCount < threshold;  // true for 5D, false for others
```

### Benefits

1. **Flexible Protection**: Different games can have different protection strategies
2. **Scalability**: 5D games can handle large user bases without unnecessary protection
3. **Fairness**: Other games maintain strict protection for low-user scenarios
4. **Maintainability**: Easy to adjust thresholds per game type
5. **Backward Compatibility**: Existing code continues to work unchanged

### Future Enhancements

The system is designed to easily support:
- Per-game threshold configuration from database
- Dynamic threshold adjustment based on time/load
- Admin interface for threshold management
- Additional game types with custom thresholds 