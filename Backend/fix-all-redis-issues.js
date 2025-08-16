const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'services', 'gameLogicService.js');

try {
    console.log('🔧 Fixing all remaining Redis issues in gameLogicService.js...');
    
    let content = fs.readFileSync(filePath, 'utf8');
    let fixedCount = 0;
    
    // Fix 1: Remove duplicate const redis declarations within the same function
    // Look for patterns where redis is declared multiple times in the same function
    const functionRegex = /async function\s+(\w+)\s*\([^)]*\)\s*\{([^}]+)\}/g;
    let functionMatch;
    
    while ((functionMatch = functionRegex.exec(content)) !== null) {
        const functionName = functionMatch[1];
        const functionBody = functionMatch[2];
        
        // Count redis declarations in this function
        const redisDeclarations = (functionBody.match(/const redis = await getRedisHelper\(\)/g) || []).length;
        
        if (redisDeclarations > 1) {
            console.log(`🔧 Function ${functionName} has ${redisDeclarations} redis declarations, fixing...`);
            
            // Find the function in the main content and fix it
            const fullFunctionRegex = new RegExp(`(async function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{[^}]+\\})`, 'g');
            content = content.replace(fullFunctionRegex, (match) => {
                // Keep only the first redis declaration, remove others
                let fixedFunction = match;
                let firstRedisFound = false;
                
                fixedFunction = fixedFunction.replace(/const redis = await getRedisHelper\(\);\s*\n\s*if\s*\(!redis\)\s*\{[^}]+\}/g, (redisBlock) => {
                    if (!firstRedisFound) {
                        firstRedisFound = true;
                        return redisBlock;
                    } else {
                        // Remove the duplicate redis declaration and its error handling
                        return '';
                    }
                });
                
                return fixedFunction;
            });
            
            fixedCount++;
        }
    }
    
    // Fix 2: Fix remaining syntax errors from the automated script
    // Pattern: const variable = const redis = await getRedisHelper();
    const syntaxErrorRegex = /const\s+(\w+)\s*=\s*const\s+redis\s*=\s*await\s+getRedisHelper\(\)/g;
    let syntaxMatch;
    
    while ((syntaxMatch = syntaxErrorRegex.exec(content)) !== null) {
        const variableName = syntaxMatch[1];
        console.log(`🔧 Fixing syntax error: ${variableName} = const redis = await getRedisHelper()`);
        
        // Find the complete pattern and replace it
        const fullPattern = new RegExp(`const\\s+${variableName}\\s*=\\s*const\\s+redis\\s*=\\s*await\\s+getRedisHelper\\(\\);[\\s\\S]*?await\\s+redis\\.(\\w+)\\(`, 'g');
        
        content = content.replace(fullPattern, (match, methodName) => {
            return `const ${variableName} = await redis.${methodName}(`;
        });
        
        fixedCount++;
    }
    
    // Fix 3: Fix parseFloat syntax error
    content = content.replace(
        /const totalBetAmount = parseFloat\(const redis = await getRedisHelper\(\)/g,
        'const totalBetAmount = parseFloat(await redis'
    );
    
    // Write the fixed content back
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log(`✅ Fixed ${fixedCount} Redis-related issues in gameLogicService.js`);
    console.log('📝 The file has been updated with proper syntax');
    
} catch (error) {
    console.error('❌ Error fixing Redis issues:', error);
}
