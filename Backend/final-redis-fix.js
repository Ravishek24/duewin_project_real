const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'services', 'gameLogicService.js');

try {
    console.log('🔧 Final Redis fix for gameLogicService.js...');
    
    let content = fs.readFileSync(filePath, 'utf8');
    let fixedCount = 0;
    
    // Fix 1: Remove all duplicate const redis declarations within the same function scope
    // This regex finds patterns where redis is declared, then used, then declared again
    const duplicateRedisPattern = /(const redis = await getRedisHelper\(\);\s*\n\s*if\s*\(!redis\)\s*\{[^}]+\}\s*\n\s*await redis\.[^;]+;\s*\n\s*)(const redis = await getRedisHelper\(\);\s*\n\s*if\s*\(!redis\)\s*\{[^}]+\}\s*\n\s*await redis\.)/g;
    
    content = content.replace(duplicateRedisPattern, (match, firstPart, secondPart) => {
        console.log('🔧 Removing duplicate redis declaration');
        fixedCount++;
        // Keep the first part, remove the second redis declaration but keep the method call
        return firstPart + secondPart.replace(/const redis = await getRedisHelper\(\);\s*\n\s*if\s*\(!redis\)\s*\{[^}]+\}\s*\n\s*/, '');
    });
    
    // Fix 2: Fix any remaining incomplete parseFloat statements
    content = content.replace(
        /const totalBetAmount = parseFloat\(await redis;/g,
        'const totalBetAmount = parseFloat(await redis.get(totalBetKey) || 0);'
    );
    
    // Fix 3: Fix any remaining syntax errors from the automated script
    content = content.replace(
        /const\s+(\w+)\s*=\s*const\s+redis\s*=\s*await\s+getRedisHelper\(\)/g,
        'const $1 = await redis'
    );
    
    // Write the fixed content back
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log(`✅ Fixed ${fixedCount} Redis-related issues in gameLogicService.js`);
    console.log('📝 The file has been updated with proper syntax');
    
} catch (error) {
    console.error('❌ Error fixing Redis issues:', error);
}
