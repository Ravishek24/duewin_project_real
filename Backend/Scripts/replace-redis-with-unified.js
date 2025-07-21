const unifiedRedis = require('../config/unifiedRedisManager');
function getRedisHelper() { return unifiedRedis.getHelper(); }
const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..');
const UNIFIED_IMPORT = `\n`;
const SKIP_FILE = 'unifiedRedisManager.js';

const REDIS_IMPORT_PATTERNS = [
  /const\s+redisHelper\s*=\s*require\(['"]\.\.\/config\/redis['"]\);?/g,
  /const\s+\{\s*redis\s*\}\s*=\s*require\(['"]\.\.\/config\/redisConfig['"]\);?/g,
  /const\s+redisManager\s*=\s*require\(['"]\.\.\/config\/redisConnectionManager['"]\);?/g,
  /const\s+Redis\s*=\s*require\(['"]ioredis['"]\);?/g,
  /const\s+redis\s*=\s*require\(['"]redis['"]\);?/g,
  /import\s+Redis\s+from\s+['"]ioredis['"];?/g,
  /import\s+redis\s+from\s+['"]redis['"];?/g
];

const REDIS_CLIENT_PATTERNS = [
  /new\s+Redis\s*\([^)]*\);?/g,
  /redis\.createClient\s*\([^)]*\);?/g
];

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

function processFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;
  let changed = false;

  // Remove old Redis imports
  REDIS_IMPORT_PATTERNS.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      changed = true;
    }
  });

  // Remove direct Redis client instantiation
  REDIS_CLIENT_PATTERNS.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      changed = true;
    }
  });

  // Add unified import at the top if any change was made and not already present
  if (changed && !content.includes('unifiedRedisManager')) {
    content = UNIFIED_IMPORT + '\n' + content;
  }

  if (changed) {
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
      console.log(`Updated: ${file}`);
    }
  });
  console.log(`\nMigration complete. Total files updated: ${changedFiles.length}`);
  if (changedFiles.length) {
    console.log('Files modified:');
    changedFiles.forEach(f => console.log(' - ' + f));
  }
}

main(); 
