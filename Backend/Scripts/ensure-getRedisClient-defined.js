const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..');
const SKIP_FILE = 'unifiedRedisManager.js';
const GET_CLIENT_FN = `function getRedisClient() {\n  if (!redisHelper) throw new Error('redisHelper not set!');\n  return redisHelper.getClient();\n}`;

const isJSFile = (file) => file.endsWith('.js');

// Patterns to match and remove top-level assignments
const TOPLEVEL_ASSIGNMENTS = [
  /^\s*const\s+redisClient\s*=\s*getRedisClient\(\);.*$/gm,
  /^\s*const\s+redisClient\s*=\s*redisHelper\.getClient\(\);.*$/gm
];

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
  let removedTopLevel = false;

  // If file uses getRedisClient() but does not define it, insert the function at the top
  if (/getRedisClient\s*\(/.test(content) && !/function\s+getRedisClient\s*\(/.test(content)) {
    // Find insertion point (after shebang or 'use strict' if present)
    let insertPos = 0;
    const lines = content.split('\n');
    if (lines[0].startsWith('#!')) insertPos = 1;
    if (lines[insertPos] && lines[insertPos].match(/['\"]use strict['\"]/)) insertPos++;
    lines.splice(insertPos, 0, GET_CLIENT_FN, '');
    content = lines.join('\n');
    changed = true;
  }

  // Remove top-level assignments
  TOPLEVEL_ASSIGNMENTS.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      changed = true;
      removedTopLevel = true;
    }
  });

  if (changed) {
    fs.writeFileSync(filepath, content, 'utf8');
    if (removedTopLevel) {
      return 'removedTopLevel';
    }
    return true;
  }
  return false;
}

function main() {
  const files = walk(TARGET_DIR);
  const changedFiles = [];
  const removedTopLevelFiles = [];
  files.forEach(file => {
    const result = processFile(file);
    if (result) {
      changedFiles.push(file);
      if (result === 'removedTopLevel') removedTopLevelFiles.push(file);
      console.log(`Updated: ${file}`);
    }
  });
  console.log(`\nUpdate complete. Total files updated: ${changedFiles.length}`);
  if (removedTopLevelFiles.length) {
    console.log('Files where top-level redisClient assignment was removed:');
    removedTopLevelFiles.forEach(f => console.log(' - ' + f));
  }
}

main(); 