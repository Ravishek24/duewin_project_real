const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..');
const SKIP_EXTENSIONS = ['.txt', '.md', '.backup', '.test.js', '.spec.js'];

const REDIS_IMPORT_PATTERNS = [
  /const\s+redis\s*=\s*require\(['"]\.\.\/config\/redis['"]\);?.*/g,
  /const\s+\{[^}]*\}\s*=\s*require\(['"]\.\.\/config\/redisConfig['"]\);?.*/g,
  /const\s+redisClient\s*=\s*require\(['"]\.\.\/config\/redisConfig['"]\)\.redis;?.*/g,
  /import\s+[^;]+from\s+['"]\.\.\/config\/redis['"];?.*/g,
  /import\s+[^;]+from\s+['"]\.\.\/config\/redisConfig['"];?.*/g
];

const isJSFile = (file) => file.endsWith('.js') && !SKIP_EXTENSIONS.some(ext => file.endsWith(ext));

function walk(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      walk(filepath, filelist);
    } else if (isJSFile(file)) {
      filelist.push(filepath);
    }
  });
  return filelist;
}

function processFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  let changed = false;

  REDIS_IMPORT_PATTERNS.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      changed = true;
    }
  });

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
      console.log(`Removed old Redis import in: ${file}`);
    }
  });
  console.log(`\nCleanup complete. Total files updated: ${changedFiles.length}`);
  if (changedFiles.length) {
    console.log('Files modified:');
    changedFiles.forEach(f => console.log(' - ' + f));
  }
}

main(); 