let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }
const fs = require('fs');
const path = require('path');

/**
 * Safe Migration Script for Unified Redis Manager
 * Migrates services to use unified Redis manager without disruption
 */

// Migration patterns
const migrationPatterns = [
    {
        name: 'redisHelper import',
        find: /const\s+redisHelper\s*=\s*require\(['"]\.\.\/config\/redis['"]\);/g,
        replace: `\n`
    },
    {
        name: 'redisConfig import',
        find: /const\s+\{\s*redis\s*\}\s*=\s*require\(['"]\.\.\/config\/redisConfig['"]\);/g,
        replace: `\nconst redis = redisHelper;`
    },
    {
        name: 'redisConfig.redis import',
        find: /const\s+redisClient\s*=\s*require\(['"]\.\.\/config\/redisConfig['"]\)\.redis;/g,
        replace: `\n`
    },
    {
        name: 'redisConfig import with destructuring',
        find: /const\s+\{\s*redis\s*:\s*(\w+)\s*\}\s*=\s*require\(['"]\.\.\/config\/redisConfig['"]\);/g,
        replace: `\nconst $1 = redisHelper;`
    }
];

/**
 * Check if a file should be migrated
 */
function shouldMigrateFile(filePath) {
    const fileName = path.basename(filePath);
    
    // Skip certain files
    const skipFiles = [
        'unifiedRedisManager.js',
        'redis.js',
        'redisConfig.js',
        'redisConnectionManager.js',
        'migrate-to-unified-redis.js',
        'fix-test-connections.js',
        'monitor-redis-connections.js'
    ];
    
    if (skipFiles.includes(fileName)) {
        return false;
    }
    
    // Skip test files for now (they'll be handled separately)
    if (fileName.startsWith('test-')) {
        return false;
    }
    
    // Skip backup files
    if (fileName.includes('.backup')) {
        return false;
    }
    
    return true;
}

/**
 * Check if file needs migration
 */
function needsMigration(content) {
    return migrationPatterns.some(pattern => pattern.find.test(content));
}

/**
 * Migrate a single file
 */
function migrateFile(filePath) {
    try {
        console.log(`🔧 Checking: ${filePath}`);
        
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Check if already migrated
        if (content.includes('unifiedRedisManager')) {
            console.log(`✅ Already migrated: ${filePath}`);
            return false;
        }
        
        // Check if needs migration
        if (!needsMigration(content)) {
            console.log(`⚠️ No migration needed: ${filePath}`);
            return false;
        }
        
        // Apply migration patterns
        for (const pattern of migrationPatterns) {
            if (pattern.find.test(content)) {
                content = content.replace(pattern.find, pattern.replace);
                modified = true;
                console.log(`  ✅ Applied: ${pattern.name}`);
            }
        }
        
        if (modified) {
            // Create backup
            const backupPath = filePath + '.backup';
            fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'), 'utf8');
            console.log(`  💾 Backup created: ${backupPath}`);
            
            // Write migrated content
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Migrated: ${filePath}`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`❌ Error migrating ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Find all files that need migration
 */
function findFilesToMigrate() {
    const filesToMigrate = [];
    
    function searchDirectory(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                searchDirectory(fullPath);
            } else if (stat.isFile() && item.endsWith('.js') && shouldMigrateFile(fullPath)) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    if (needsMigration(content)) {
                        filesToMigrate.push(fullPath);
                    }
                } catch (error) {
                    console.error(`❌ Error reading ${fullPath}:`, error.message);
                }
            }
        }
    }
    
    searchDirectory('.');
    return filesToMigrate;
}

/**
 * Create initialization script
 */
function createInitializationScript() {
    const initScript = `
// Backend/scripts/init-unified-redis.js


/**
 * Initialize Unified Redis Manager
 * Run this before starting your application
 */
async function initializeUnifiedRedis() {
    try {
        console.log('🚀 Initializing Unified Redis Manager...');
        await unifiedRedis.initialize();
        console.log('✅ Unified Redis Manager initialized successfully');
        
        // Test the connections
        const healthCheck = await unifiedRedis.healthCheck();
        console.log('📊 Health Check Results:', healthCheck);
        
        // Show stats
        const stats = unifiedRedis.getStats();
        console.log('📈 Manager Stats:', stats);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Unified Redis Manager:', error.message);
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    initializeUnifiedRedis()
        .then(success => {
            if (success) {
                console.log('🎉 Unified Redis Manager ready for use');
                process.exit(0);
            } else {
                console.error('💥 Failed to initialize Unified Redis Manager');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { initializeUnifiedRedis };
`;
    
    fs.writeFileSync('./scripts/init-unified-redis.js', initScript);
    console.log('✅ Created initialization script: scripts/init-unified-redis.js');
}

/**
 * Create rollback script
 */
function createRollbackScript() {
    const rollbackScript = `
// Backend/scripts/rollback-redis-migration.js
const fs = require('fs');
const path = require('path');

/**
 * Rollback Redis Migration
 * Restores files from backup if migration causes issues
 */
function rollbackMigration() {
    console.log('🔄 Rolling back Redis migration...');
    
    let restoredCount = 0;
    let errorCount = 0;
    
    function searchBackups(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                searchBackups(fullPath);
            } else if (stat.isFile() && item.endsWith('.backup')) {
                try {
                    const originalPath = fullPath.replace('.backup', '');
                    fs.copyFileSync(fullPath, originalPath);
                    console.log(\`✅ Restored: \${originalPath}\`);
                    restoredCount++;
                } catch (error) {
                    console.error(\`❌ Error restoring \${fullPath}:\`, error.message);
                    errorCount++;
                }
            }
        }
    }
    
    searchBackups('.');
    
    console.log(\`\\n📊 Rollback Summary:\`);
    console.log(\`  - Files restored: \${restoredCount}\`);
    console.log(\`  - Errors: \${errorCount}\`);
    
    if (errorCount === 0) {
        console.log('✅ Rollback completed successfully');
    } else {
        console.log('⚠️ Rollback completed with errors');
    }
}

// Run if called directly
if (require.main === module) {
    rollbackMigration();
}

module.exports = { rollbackMigration };
`;
    
    fs.writeFileSync('./scripts/rollback-redis-migration.js', rollbackScript);
    console.log('✅ Created rollback script: scripts/rollback-redis-migration.js');
}

/**
 * Main migration function
 */
async function main() {
    console.log('🚀 Redis Migration to Unified Manager');
    console.log('=====================================');
    
    // Find files to migrate
    console.log('🔍 Searching for files to migrate...');
    const filesToMigrate = findFilesToMigrate();
    
    console.log(`📋 Found ${filesToMigrate.length} files to migrate:`);
    filesToMigrate.forEach(file => console.log(`  - ${file}`));
    
    if (filesToMigrate.length === 0) {
        console.log('✅ No files need migration');
        return;
    }
    
    // Ask for confirmation
    console.log('\n⚠️ WARNING: This will modify your files and create backups.');
    console.log('Make sure you have committed your current changes to git.');
    console.log('\nProceeding with migration...');
    
    // Migrate files
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const file of filesToMigrate) {
        try {
            if (migrateFile(file)) {
                migratedCount++;
            }
        } catch (error) {
            console.error(`❌ Error migrating ${file}:`, error.message);
            errorCount++;
        }
    }
    
    // Create utility scripts
    createInitializationScript();
    createRollbackScript();
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`  - Files processed: ${filesToMigrate.length}`);
    console.log(`  - Files migrated: ${migratedCount}`);
    console.log(`  - Errors: ${errorCount}`);
    
    if (errorCount === 0) {
        console.log('\n✅ Migration completed successfully!');
        console.log('\n📋 Next Steps:');
        console.log('1. Initialize the unified manager: node scripts/init-unified-redis.js');
        console.log('2. Test your application thoroughly');
        console.log('3. If issues occur, rollback: node scripts/rollback-redis-migration.js');
        console.log('4. Once confirmed working, you can remove old Redis config files');
    } else {
        console.log('\n⚠️ Migration completed with errors. Check the logs above.');
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    migrateFile,
    findFilesToMigrate,
    needsMigration,
    createInitializationScript,
    createRollbackScript
}; 