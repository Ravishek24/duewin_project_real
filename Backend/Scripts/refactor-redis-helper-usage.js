const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..');
const SKIP_FILE = 'unifiedRedisManager.js';

const REDIS_HELPER_TOPLEVEL_PATTERN = /const\s+redisClient\s*=\s*redisHelper\.getClient\(\);?/g;
const REDIS_HELPER_METHOD_PATTERN = /redisHelper\.([a-zA-Z0-9_]+)\([^)]*\)/g;

const GET_CLIENT_FN = `function getRedisClient() {\n  if (!redisHelper) throw new Error('redisHelper not set!');\n  return getRedisClient();\n}`;

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
  let changed = false;

  // Replace top-level getRedisClient() assignment
  if (REDIS_HELPER_TOPLEVEL_PATTERN.test(content)) {
    content = content.replace(REDIS_HELPER_TOPLEVEL_PATTERN, '');
    // Insert getRedisClient function at the top if not present
    if (!content.includes('function getRedisClient()')) {
      content = GET_CLIENT_FN + '\n' + content;
    }
    changed = true;
  }

  // Replace any top-level getRedisClient() usage with getRedisClient() inside functions
  // (We do not replace inside the getRedisClient function itself)
  let lines = content.split('\n');
  let inFunction = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/function\s+[a-zA-Z0-9_]+\s*\(/.test(line) || /=>\s*\{/.test(line)) {
      inFunction = true;
    }
    if (inFunction && /redisHelper\.getClient\(\)/.test(line)) {
      lines[i] = line.replace(/redisHelper\.getClient\(\)/g, 'getRedisClient()');
      changed = true;
    }
    if (/^}/.test(line)) {
      inFunction = false;
    }
  }
  content = lines.join('\n');

  // Optionally, wrap other redisHelper.<method>() usages at the top level (not just getClient)
  // For now, just warn if found at the top level
  if (!inFunction && REDIS_HELPER_METHOD_PATTERN.test(content)) {
    // Could add more wrappers here if needed
    // For now, just log a warning
    // console.warn(`Warning: ${filepath} uses redisHelper.<method>() at the top level.`);
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