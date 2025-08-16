#!/usr/bin/env node

/**
 * Fix Redis Await Issues Script
 * This script fixes all missing await keywords when calling unifiedRedis.getHelper()
 */

const fs = require('fs');
const path = require('path');

// Patterns to search and replace
const patterns = [
    {
        // Pattern 1: const redis = unifiedRedis.getHelper();
        search: /const\s+(\w+)\s*=\s*unifiedRedis\.getHelper\(\)/g,
        replace: 'const $1 = await unifiedRedis.getHelper()',
        description: 'Fix missing await in variable assignment'
    },
    {
        // Pattern 2: const redis = getRedisHelper();
        search: /const\s+(\w+)\s*=\s*getRedisHelper\(\)/g,
        replace: 'const $1 = await getRedisHelper()',
        description: 'Fix missing await in getRedisHelper calls'
    },
    {
        // Pattern 3: function getRedisHelper() { return unifiedRedis.getHelper(); }
        search: /function\s+getRedisHelper\(\)\s*\{\s*return\s+unifiedRedis\.getHelper\(\);\s*\}/g,
        replace: 'async function getRedisHelper() { return await unifiedRedis.getHelper(); }',
        description: 'Fix getRedisHelper function to be async'
    },
    {
        // Pattern 4: return unifiedRedis.getHelper();
        search: /return\s+unifiedRedis\.getHelper\(\)/g,
        replace: 'return await unifiedRedis.getHelper()',
        description: 'Fix missing await in return statements'
    }
];

// Direct calls that need fixing
const directCalls = [
    {
        // Pattern 5: await unifiedRedis.getHelper().method()
        search: /await\s+unifiedRedis\.getHelper\(\)\./g,
        replace: 'const redis = await unifiedRedis.getHelper(); await redis.',
        description: 'Fix direct method calls on getHelper()'
    }
];

// Files to process (focus on critical services)
const criticalFiles = [
    'Backend/services/5dParallelProcessor.js',
    'Backend/services/5dSortedSetService.js',
    'Backend/services/fiveDProtectionService.js',
    'Backend/services/gameLogicService.js',
    'Backend/services/adminExposureService.js',
    'Backend/scripts/5dPreCalcScheduler.js',
    'Backend/scripts/masterCronJobs.js',
    'Backend/queues/attendanceWorker.js',
    'Backend/queues/depositWorker.js',
    'Backend/queues/withdrawalWorker.js',
    'Backend/queues/registrationWorker.js',
    'Backend/workers/workerManager.js'
];

// Test files that also need fixing
const testFiles = [
    'Backend/test-5d-exposure-fix.js',
    'Backend/test-5d-independent-precalc.js',
    'Backend/test-5d-precalc-integration.js',
    'Backend/test-5d-protection-final.js',
    'Backend/test-admin-set-result.js',
    'Backend/test-bet-exposure-tracking.js',
    'Backend/test-enhanced-exposure-working.js',
    'Backend/test-exposure-system-working.js',
    'Backend/test-redis-connection.js',
    'Backend/test-redis-methods.js',
    'Backend/testWebSocketGames.js'
];

// Debug/utility files
const debugFiles = [
    'Backend/debug-5d-exposure-issue.js',
    'Backend/debug-admin-result-issue.js',
    'Backend/check-redis-admin-results.js',
    'Backend/check-specific-period.js',
    'Backend/fix-admin-redis.js',
    'Backend/scripts/monitor-redis-connections.js',
    'Backend/scripts/monitor_performance.js',
    'Backend/scripts/replace-redis-with-unified.js',
    'Backend/scripts/test-attendance-cron-logic.js',
    'Backend/scripts/test-vault-interest-cron-logic.js',
    'Backend/scripts/test-period-creation.js',
    'Backend/scripts/test-redis-pipeline-fix.js'
];

// Controller files
const controllerFiles = [
    'Backend/controllers/adminController/wingoGameController.js',
    'Backend/controllers/adminController/wingoGameController-FIXED.js',
    'Backend/controllers/adminController/wingoGameController-ORIGINAL.js'
];

// All files to process
const allFiles = [...criticalFiles, ...testFiles, ...debugFiles, ...controllerFiles];

/**
 * Process a single file
 */
function processFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ File not found: ${filePath}`);
            return { processed: false, reason: 'File not found' };
        }

        const content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        let changes = [];

        // Apply all patterns
        for (const pattern of patterns) {
            const matches = content.match(pattern.search);
            if (matches) {
                const newContent = content.replace(pattern.search, pattern.replace);
                if (newContent !== content) {
                    content = newContent;
                    modified = true;
                    changes.push(`${pattern.description}: ${matches.length} matches`);
                }
            }
        }

        // Apply direct call fixes
        for (const pattern of directCalls) {
            const matches = content.match(pattern.search);
            if (matches) {
                const newContent = content.replace(pattern.search, pattern.replace);
                if (newContent !== content) {
                    content = newContent;
                    modified = true;
                    changes.push(`${pattern.description}: ${matches.length} matches`);
                }
            }
        }

        // Write file if modified
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            return { processed: true, changes };
        }

        return { processed: false, reason: 'No changes needed' };

    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        return { processed: false, reason: `Error: ${error.message}` };
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('🔧 Fixing Redis Await Issues...\n');

    let totalProcessed = 0;
    let totalChanges = 0;

    for (const filePath of allFiles) {
        console.log(`📁 Processing: ${filePath}`);
        
        const result = processFile(filePath);
        
        if (result.processed) {
            console.log(`✅ Fixed: ${result.changes.join(', ')}`);
            totalProcessed++;
            totalChanges += result.changes.length;
        } else {
            console.log(`⏭️ Skipped: ${result.reason}`);
        }
        
        console.log('');
    }

    console.log('🎯 Summary:');
    console.log(`   Files processed: ${totalProcessed}/${allFiles.length}`);
    console.log(`   Total changes: ${totalChanges}`);
    
    if (totalProcessed > 0) {
        console.log('\n✅ Redis await issues have been fixed!');
        console.log('🔄 Please restart your application to apply the changes.');
    } else {
        console.log('\n✅ No Redis await issues found!');
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
}

module.exports = { processFile, patterns, directCalls };
