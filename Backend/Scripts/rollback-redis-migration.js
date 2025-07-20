
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
                    console.log(`✅ Restored: ${originalPath}`);
                    restoredCount++;
                } catch (error) {
                    console.error(`❌ Error restoring ${fullPath}:`, error.message);
                    errorCount++;
                }
            }
        }
    }
    
    searchBackups('.');
    
    console.log(`\n📊 Rollback Summary:`);
    console.log(`  - Files restored: ${restoredCount}`);
    console.log(`  - Errors: ${errorCount}`);
    
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
