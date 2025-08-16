const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'services', 'gameLogicService.js');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Function to fix await getRedisHelper().method() calls
function fixRedisHelperCalls(content) {
    // Pattern to match: await getRedisHelper().methodName(...)
    const pattern = /await getRedisHelper\(\)\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    
    let match;
    let fixedContent = content;
    let offset = 0;
    
    while ((match = pattern.exec(content)) !== null) {
        const methodName = match[1];
        const startPos = match.index;
        const endPos = startPos + match[0].length;
        
        // Find the end of the method call (matching parentheses)
        let parenCount = 0;
        let callEndPos = endPos;
        let inString = false;
        let stringChar = '';
        
        for (let i = endPos; i < content.length; i++) {
            const char = content[i];
            
            if (!inString && (char === '"' || char === "'")) {
                inString = true;
                stringChar = char;
            } else if (inString && char === stringChar) {
                inString = false;
            } else if (!inString) {
                if (char === '(') {
                    parenCount++;
                } else if (char === ')') {
                    if (parenCount === 0) {
                        callEndPos = i + 1;
                        break;
                    }
                    parenCount--;
                }
            }
        }
        
        // Extract the method call arguments
        const methodCall = content.substring(startPos, callEndPos);
        const args = methodCall.replace(/^await getRedisHelper\(\)\.[a-zA-Z_][a-zA-Z0-9_]*\s*\(/, '').replace(/\)$/, '');
        
        // Create the replacement
        const replacement = `const redis = await getRedisHelper();
        if (!redis) {
            console.error('❌ Redis helper not available');
            throw new Error('Redis helper not available');
        }
        await redis.${methodName}(${args})`;
        
        // Replace in the fixed content
        const actualStartPos = startPos + offset;
        const actualEndPos = callEndPos + offset;
        
        fixedContent = fixedContent.substring(0, actualStartPos) + 
                      replacement + 
                      fixedContent.substring(actualEndPos);
        
        // Update offset for next replacements
        offset += replacement.length - methodCall.length;
    }
    
    return fixedContent;
}

// Apply the fix
const fixedContent = fixRedisHelperCalls(content);

// Write the fixed content back
fs.writeFileSync(filePath, fixedContent, 'utf8');

console.log('✅ Fixed all await getRedisHelper().method() calls in gameLogicService.js');
console.log('📝 The file has been updated with proper Redis helper usage');
