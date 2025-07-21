const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..');
const SKIP_FILE = 'unifiedRedisManager.js';

const UNIFIED_IMPORT_PATTERN = /const\s+unifiedRedis\s*=\s*require\(['"]\.\.\/config\/unifiedRedisManager['"]\);?/g;
const GET_HELPER_PATTERN = /const\s+redisHelper\s*=\s*unifiedRedis\.getHelper\(\);?/g;
const GET_CONNECTION_PATTERN = /const\s+redisClient\s*=\s*unifiedRedis\.getConnection\([^)]*\);?/g;
const TOP_LEVEL_GET_HELPER = /unifiedRedis\.getHelper\(\)/g;
const TOP_LEVEL_GET_CONNECTION = /unifiedRedis\.getConnection\([^)]*\)/g;

const SETTER_SNIPPET = `let redisHelper = null;\nfunction setRedisHelper(helper) { redisHelper = helper; }`;

const isJSFile = (file) => file.endsWith('.js');

function walk(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      walk(filepath, filelist);
    } else if (isJSFile(file) && !filepath.endsWith(SKIP_FILE)) {
      filelist.push(filepath);
    }
  });
  return filelist;
}

function ensureSetterExport(content) {
  // Add setRedisHelper to module.exports if not present
  if (/module\.exports\s*=\s*\{[^}]*\}/.test(content)) {
    // Already exporting an object
    if (!/setRedisHelper/.test(content)) {
      return content.replace(/module\.exports\s*=\s*\{/, 'module.exports = {\n    setRedisHelper,');
    }
    return content;
  } else if (/module\.exports\s*=/.test(content)) {
    // Some other export style
    return content + '\nmodule.exports.setRedisHelper = setRedisHelper;\n';
  } else {
    // No exports found
    return content + '\nmodule.exports = { setRedisHelper };\n';
  }
}

function processFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  let changed = false;

  // Remove unifiedRedis import and top-level getHelper/getConnection
  if (UNIFIED_IMPORT_PATTERN.test(content) && (GET_HELPER_PATTERN.test(content) || GET_CONNECTION_PATTERN.test(content))) {
    content = content.replace(UNIFIED_IMPORT_PATTERN, '');
    content = content.replace(GET_HELPER_PATTERN, '');
    content = content.replace(GET_CONNECTION_PATTERN, '');
    // Insert setter snippet at the top
    content = SETTER_SNIPPET + '\n' + content;
    changed = true;
  }

  // Replace any remaining top-level redisHelper/getConnection() with redisHelper
  if (TOP_LEVEL_GET_HELPER.test(content) || TOP_LEVEL_GET_CONNECTION.test(content)) {
    content = content.replace(TOP_LEVEL_GET_HELPER, 'redisHelper');
    content = content.replace(TOP_LEVEL_GET_CONNECTION, 'redisHelper');
    changed = true;
  }

  // Ensure setRedisHelper is exported
  if (changed) {
    content = ensureSetterExport(content);
    fs.writeFileSync(filepath, content, 'utf8');
    return true;
  }
  return false;
}

function main() {
  const files = walk(TARGET_DIR);
  const changedFiles = [];
  files.forEach(file => {
    if (processFile(file)) {
      changedFiles.push(file);
      console.log(`Refactored: ${file}`);
    }
  });
  console.log(`\nRefactor complete. Total files updated: ${changedFiles.length}`);
  if (changedFiles.length) {
    console.log('Files modified:');
    changedFiles.forEach(f => console.log(' - ' + f));
  }
}

main(); 