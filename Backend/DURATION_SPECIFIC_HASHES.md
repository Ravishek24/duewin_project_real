# Duration-Specific Hash Implementation for TRX_WIX

## Overview

This implementation ensures that each TRX_WIX duration (30s, 60s, 180s, 300s) gets **unique hashes** for result verification, preventing hash sharing between different durations.

## Problem Solved

**Before**: All TRX_WIX durations shared the same hash collection (`tron:hash_collection`), meaning:
- 30s, 60s, 180s, and 300s durations could get the same hash
- No uniqueness guarantee across durations
- Hash collisions between different duration periods

**After**: Each duration has its own dedicated hash collection:
- `tron:hash_collection:30` for 30s duration
- `tron:hash_collection:60` for 60s duration  
- `tron:hash_collection:180` for 180s duration
- `tron:hash_collection:300` for 300s duration

## Key Changes

### 1. Modified `tronHashService.js`

**New Functions:**
- `getDurationHashKey(duration)` - Generates duration-specific Redis keys
- `getTrxWixDurations()` - Returns array of all TRX_WIX durations [30, 60, 180, 300]

**Updated Functions:**
- `updateHashCollection(hashes, duration)` - Now accepts duration parameter
- `hasEnoughHashes(duration)` - Checks duration-specific collections
- `getHashForResult(result, duration)` - Gets hash from duration-specific collection
- `getResultWithVerification(result, duration)` - Accepts duration parameter
- `startHashCollection()` - Now collects hashes for all durations separately

### 2. Updated `gameLogicService.js`

**Modified:**
- `calculateResultWithVerification()` - Now passes duration to tronHashService

## Redis Key Structure

```
tron:hash_collection:30    # 30s duration hashes
tron:hash_collection:60    # 60s duration hashes  
tron:hash_collection:180   # 180s duration hashes
tron:hash_collection:300   # 300s duration hashes
```

Each key contains:
```json
{
  "0": ["hash1", "hash2", ...],
  "1": ["hash1", "hash2", ...],
  ...
  "9": ["hash1", "hash2", ...]
}
```

## Benefits

1. **Unique Hashes**: Each duration gets completely separate hash pools
2. **No Collisions**: Impossible for different durations to share the same hash
3. **Better Transparency**: Players can verify that each duration has independent verification
4. **Scalability**: Easy to add more durations in the future
5. **Isolation**: Issues with one duration don't affect others

## Testing

### Test Scripts Created:

1. **`test-duration-specific-hashes.js`**
   - Tests hash generation for all durations
   - Verifies uniqueness across durations
   - Shows Redis collection status

2. **`clear-old-hash-collections.js`**
   - Clears old global hash collection
   - Clears all duration-specific collections
   - Starts fresh hash collection

### Running Tests:

```bash
# Clear old collections and start fresh
node clear-old-hash-collections.js

# Test the new functionality
node test-duration-specific-hashes.js
```

## Migration Notes

- **Backward Compatibility**: Old global collection still works as fallback
- **Automatic Migration**: New system automatically creates duration-specific collections
- **No Data Loss**: Existing results remain valid
- **Gradual Rollout**: Can be deployed without downtime

## Verification

To verify the implementation is working:

1. Check that each duration gets different hashes for the same result number
2. Verify Redis keys exist for each duration
3. Confirm hash collections are independent
4. Test that fallback still works if collections are empty

## Example Output

```
🧪 Testing Duration-Specific Hash Generation for TRX_WIX
=====================================================
📋 TRX_WIX Durations: [30, 60, 180, 300]

🔄 Testing duration: 30s
✅ Duration 30s: { result: 5, hash: "a1b2c3d4...", link: "https://..." }

🔄 Testing duration: 60s  
✅ Duration 60s: { result: 5, hash: "e5f6g7h8...", link: "https://..." }

🔄 Testing duration: 180s
✅ Duration 180s: { result: 5, hash: "i9j0k1l2...", link: "https://..." }

🔄 Testing duration: 300s
✅ Duration 300s: { result: 5, hash: "m3n4o5p6...", link: "https://..." }

🔍 Hash Uniqueness Check:
Total hashes: 4
Unique hashes: 4
✅ SUCCESS: All hashes are unique!
```

## Future Enhancements

1. **Hash Rotation**: Implement hash rotation within each duration
2. **Hash Validation**: Add validation to ensure hashes are real TRON block hashes
3. **Hash Analytics**: Track hash usage patterns per duration
4. **Hash Backup**: Implement backup hash collections for redundancy 