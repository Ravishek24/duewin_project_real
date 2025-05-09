/**
 * Script to fix auth middleware issues related to user ID field
 * Run with: node fix-auth-middleware.js
 */

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/db');

async function fixAuthMiddleware() {
  console.log('Starting auth middleware fix...');
  
  try {
    // 1. Find auth middleware file
    const authMiddlewarePath = path.join(__dirname, '..', 'middlewares', 'authMiddleware.js');
    
    if (!fs.existsSync(authMiddlewarePath)) {
      console.error('❌ Auth middleware file not found at:', authMiddlewarePath);
      return false;
    }
    
    console.log('✅ Found auth middleware file');
    
    // 2. Read the current content
    const currentContent = fs.readFileSync(authMiddlewarePath, 'utf8');
    console.log('Read auth middleware file');
    
    // 3. Check if fix is needed
    const hasUserIdFix = currentContent.includes('req.user.user_id = req.user.id');
    if (hasUserIdFix) {
      console.log('✅ Auth middleware already contains the fix');
      return true;
    }
    
    // 4. Find where to insert the fix
    const lines = currentContent.split('\n');
    let jwtVerifyIndex = -1;
    let insertionLine = -1;
    
    // Look for the jwt.verify section
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('jwt.verify')) {
        jwtVerifyIndex = i;
      }
      
      // Look for where user is attached to req object
      if (jwtVerifyIndex !== -1 && lines[i].includes('req.user =')) {
        insertionLine = i + 1; // Insert after this line
        break;
      }
    }
    
    if (insertionLine === -1) {
      console.error('❌ Could not find appropriate location for the fix');
      console.log('Please manually add this code after req.user is set:');
      console.log('    // Add compatibility for different user ID field names');
      console.log('    if (req.user.id && !req.user.user_id) {');
      console.log('      req.user.user_id = req.user.id;');
      console.log('    } else if (req.user.user_id && !req.user.id) {');
      console.log('      req.user.id = req.user.user_id;');
      console.log('    }');
      return false;
    }
    
    // 5. Insert the fix
    console.log(`Inserting fix at line ${insertionLine + 1}`);
    
    const fixCode = [
      '    // Add compatibility for different user ID field names',
      '    if (req.user.id && !req.user.user_id) {',
      '      req.user.user_id = req.user.id;',
      '    } else if (req.user.user_id && !req.user.id) {',
      '      req.user.id = req.user.user_id;',
      '    }'
    ];
    
    lines.splice(insertionLine, 0, ...fixCode);
    const newContent = lines.join('\n');
    
    // 6. Backup original file
    const backupPath = `${authMiddlewarePath}.backup`;
    fs.writeFileSync(backupPath, currentContent);
    console.log(`✅ Original file backed up to ${backupPath}`);
    
    // 7. Write the updated file
    fs.writeFileSync(authMiddlewarePath, newContent);
    console.log('✅ Auth middleware updated successfully');
    
    console.log('\nFix applied:');
    console.log('- Added compatibility layer for user ID fields');
    console.log('- The middleware now supports both req.user.id and req.user.user_id');
    console.log('- Controllers can use either field name');
    
    return true;
  } catch (error) {
    console.error('❌ Error fixing auth middleware:', error);
    return false;
  }
}

// Run if executed directly
if (require.main === module) {
  fixAuthMiddleware()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} 