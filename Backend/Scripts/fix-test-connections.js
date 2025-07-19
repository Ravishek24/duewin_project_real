const fs = require('fs');
const path = require('path');

/**
 * Fix test files to prevent Redis connection leaks
 * This script updates test files to use the new connection manager
 */

// Patterns to find and replace
const patterns = [
    {
        name: 'Direct Redis import and creation',
        find: /const\s+Redis\s*=\s*require\(['"]ioredis['"]\);\s*\n\s*const\s+redis\s*=\s*new\s+Redis\(/g,
        replace: `const { createTestHelper } = require('../utils/testRedisHelper');\nconst helper = createTestHelper();\nconst redis = helper.getMainConnection();`
    },
    {
        name: 'Redis client creation',
        find: /const\s+redisClient\s*=\s*new\s+Redis\(/g,
        replace: `const { createTestHelper } = require('../utils/testRedisHelper');\nconst helper = createTestHelper();\nconst redisClient = helper.getMainConnection();`
    },
    {
        name: 'Redis createClient',
        find: /const\s+redisClient\s*=\s*redis\.createClient\(/g,
        replace: `const { createTestHelper } = require('../utils/testRedisHelper');\nconst helper = createTestHelper();\nconst redisClient = helper.getMainConnection();`
    },
    {
        name: 'Process exit without cleanup',
        find: /process\.exit\(/g,
        replace: `await helper.cleanup();\nprocess.exit(`
    },
    {
        name: 'Missing cleanup in finally block',
        find: /}\s*catch\s*\(error\)\s*{\s*console\.error\(/g,
        replace: `} catch (error) {\n        console.error(`
    },
    {
        name: 'Add cleanup to finally block',
        find: /}\s*finally\s*{\s*([^}]*)\s*}/g,
        replace: `} finally {\n        await helper.cleanup();\n        $1\n    }`
    }
];

/**
 * Check if a file is a test file
 */
function isTestFile(filename) {
    return filename.startsWith('test-') && filename.endsWith('.js');
}

/**
 * Fix a single test file
 */
function fixTestFile(filePath) {
    try {
        console.log(`🔧 Fixing: ${filePath}`);
        
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Check if file already uses the helper
        if (content.includes('testRedisHelper')) {
            console.log(`✅ Already fixed: ${filePath}`);
            return false;
        }
        
        // Apply patterns
        for (const pattern of patterns) {
            if (pattern.find.test(content)) {
                content = content.replace(pattern.find, pattern.replace);
                modified = true;
                console.log(`  ✅ Applied: ${pattern.name}`);
            }
        }
        
        // Add cleanup if missing
        if (modified && !content.includes('helper.cleanup()')) {
            // Find the main function and add cleanup
            if (content.includes('async function')) {
                content = content.replace(
                    /(async function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?)(\n\s*\}\s*$)/,
                    `$1\n    await helper.cleanup();\n$2`
                );
            } else if (content.includes('function')) {
                content = content.replace(
                    /(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?)(\n\s*\}\s*$)/,
                    `$1\n    await helper.cleanup();\n$2`
                );
            }
        }
        
        // Add process handlers for cleanup
        if (modified && !content.includes('process.on')) {
            const cleanupHandlers = `
// Graceful shutdown
process.on('SIGINT', async () => {
    await helper.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await helper.cleanup();
    process.exit(0);
});

`;
            content = cleanupHandlers + content;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Fixed: ${filePath}`);
            return true;
        } else {
            console.log(`⚠️ No changes needed: ${filePath}`);
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Error fixing ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Find and fix all test files
 */
function fixAllTestFiles() {
    console.log('🔍 Searching for test files...');
    
    const testFiles = [];
    
    // Search in current directory and subdirectories
    function searchDirectory(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                searchDirectory(fullPath);
            } else if (stat.isFile() && isTestFile(item)) {
                testFiles.push(fullPath);
            }
        }
    }
    
    searchDirectory('.');
    
    console.log(`📋 Found ${testFiles.length} test files:`);
    testFiles.forEach(file => console.log(`  - ${file}`));
    
    let fixedCount = 0;
    
    for (const file of testFiles) {
        if (fixTestFile(file)) {
            fixedCount++;
        }
    }
    
    console.log(`\n🎯 Summary:`);
    console.log(`  - Total test files: ${testFiles.length}`);
    console.log(`  - Files fixed: ${fixedCount}`);
    console.log(`  - Files already fixed: ${testFiles.length - fixedCount}`);
    
    return { total: testFiles.length, fixed: fixedCount };
}

/**
 * Create a backup of test files before fixing
 */
function backupTestFiles() {
    console.log('💾 Creating backup of test files...');
    
    const backupDir = './test-backup-' + Date.now();
    fs.mkdirSync(backupDir, { recursive: true });
    
    const testFiles = [];
    
    function searchDirectory(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                searchDirectory(fullPath);
            } else if (stat.isFile() && isTestFile(item)) {
                testFiles.push(fullPath);
            }
        }
    }
    
    searchDirectory('.');
    
    for (const file of testFiles) {
        const backupPath = path.join(backupDir, file);
        const backupDirPath = path.dirname(backupPath);
        
        fs.mkdirSync(backupDirPath, { recursive: true });
        fs.copyFileSync(file, backupPath);
    }
    
    console.log(`✅ Backup created in: ${backupDir}`);
    return backupDir;
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 Redis Test Connection Fixer');
    console.log('================================');
    
    // Create backup
    const backupDir = backupTestFiles();
    
    // Fix test files
    const results = fixAllTestFiles();
    
    console.log('\n📋 Next Steps:');
    console.log('1. Review the changes in your test files');
    console.log('2. Test a few files to ensure they work correctly');
    console.log('3. If issues occur, restore from backup:', backupDir);
    console.log('4. Run your tests to verify Redis connections are properly managed');
    
    console.log('\n🔧 Manual fixes needed:');
    console.log('- Some files may need manual adjustment');
    console.log('- Check for any remaining Redis connection creation');
    console.log('- Ensure all async functions properly await helper.cleanup()');
    
    return results;
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    fixTestFile,
    fixAllTestFiles,
    backupTestFiles,
    isTestFile
}; 