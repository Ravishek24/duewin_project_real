/**
 * Standalone script to directly fix auth middleware
 * Run with: node direct-fix-auth.js
 */

const fs = require('fs');
const path = require('path');

// Find the auth middleware file
const authMiddlewarePath = path.join(__dirname, '..', 'middlewares', 'authMiddleware.js');

// Check if file exists
if (!fs.existsSync(authMiddlewarePath)) {
  console.error('❌ Auth middleware file not found at:', authMiddlewarePath);
  process.exit(1);
}

console.log('✅ Found auth middleware file');

// Read the file
let content = fs.readFileSync(authMiddlewarePath, 'utf8');

// Check if fix is needed
if (content.includes('req.user.user_id = req.user.id') || 
    content.includes('// Add compatibility for different user ID field names')) {
  console.log('✅ Auth middleware already contains the fix');
  process.exit(0);
}

// Create a backup of the original file
const backupPath = `${authMiddlewarePath}.backup`;
fs.writeFileSync(backupPath, content);
console.log(`✅ Original file backed up to ${backupPath}`);

// Apply the fix
console.log('Applying auth middleware fix...');

// Method 1: Try to find where req.user is set
const fixPattern = /req\.user\s*=\s*decoded/;
if (fixPattern.test(content)) {
  content = content.replace(
    fixPattern,
    'req.user = decoded;\n    // Add compatibility for different user ID field names\n    if (req.user.id && !req.user.user_id) {\n      req.user.user_id = req.user.id;\n    } else if (req.user.user_id && !req.user.id) {\n      req.user.id = req.user.user_id;\n    }'
  );
  
  console.log('✅ Fix applied using pattern matching');
} else {
  // Method 2: Try to find the auth middleware function
  const authFunctionPattern = /const auth\s*=\s*async\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*=>\s*\{/;
  if (authFunctionPattern.test(content)) {
    // Find the closing brace of the try block
    const tryMatch = content.match(/try\s*\{([\s\S]*?)\}\s*catch/);
    
    if (tryMatch) {
      const tryBlock = tryMatch[1];
      const fixedTryBlock = tryBlock + '\n    // Add compatibility for different user ID field names\n    if (req.user.id && !req.user.user_id) {\n      req.user.user_id = req.user.id;\n    } else if (req.user.user_id && !req.user.id) {\n      req.user.id = req.user.user_id;\n    }';
      
      content = content.replace(tryBlock, fixedTryBlock);
      console.log('✅ Fix applied by modifying the try block');
    } else {
      // Method 3: Just append the fix code to the entire file
      const fixCode = `
// Added fix for ID field compatibility
const originalAuth = module.exports.auth;
module.exports.auth = async (req, res, next) => {
  await originalAuth(req, res, next);
  
  // This runs after the original auth middleware
  // Make sure both id and user_id are available
  if (req.user && req.user.id && !req.user.user_id) {
    req.user.user_id = req.user.id;
  } else if (req.user && req.user.user_id && !req.user.id) {
    req.user.id = req.user.user_id;
  }
};
`;
      content += fixCode;
      console.log('✅ Fix applied by adding a wrapper function');
    }
  } else {
    console.log('❌ Could not find appropriate location for the fix');
    console.log('Please manually add this code after req.user is set:');
    console.log('    // Add compatibility for different user ID field names');
    console.log('    if (req.user.id && !req.user.user_id) {');
    console.log('      req.user.user_id = req.user.id;');
    console.log('    } else if (req.user.user_id && !req.user.id) {');
    console.log('      req.user.id = req.user.user_id;');
    console.log('    }');
    process.exit(1);
  }
}

// Write the updated file
fs.writeFileSync(authMiddlewarePath, content);
console.log('✅ Auth middleware updated successfully');

console.log('\nPlease restart the application for changes to take effect.');
process.exit(0); 