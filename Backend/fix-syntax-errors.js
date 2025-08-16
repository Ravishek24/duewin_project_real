const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'services', 'gameLogicService.js');

try {
    console.log('🔧 Fixing syntax errors in gameLogicService.js...');
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix the pattern: const variable = const redis = await getRedisHelper();
    // This should become: const variable = await redis.method();
    const regex = /const\s+(\w+)\s*=\s*const\s+redis\s*=\s*await\s+getRedisHelper\(\);\s*\n\s*if\s*\(!redis\)\s*{\s*\n\s*console\.error\('❌ Redis helper not available'\);\s*\n\s*throw\s+new\s+Error\('Redis helper not available'\);\s*\n\s*}\s*\n\s*await\s+redis\.(\w+)\(/g;
    
    let match;
    let fixedCount = 0;
    
    while ((match = regex.exec(content)) !== null) {
        const variableName = match[1];
        const methodName = match[2];
        
        console.log(`🔧 Fixing: ${variableName} = const redis = await getRedisHelper()`);
        
        // Replace the entire pattern
        const oldPattern = match[0];
        const newPattern = `const ${variableName} = await redis.${methodName}(`;
        
        content = content.replace(oldPattern, newPattern);
        fixedCount++;
    }
    
    // Write the fixed content back
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log(`✅ Fixed ${fixedCount} syntax errors in gameLogicService.js`);
    console.log('📝 The file has been updated with proper syntax');
    
} catch (error) {
    console.error('❌ Error fixing syntax errors:', error);
}
