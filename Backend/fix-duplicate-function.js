const fs = require('fs');
const path = require('path');

console.log('Starting fix for duplicate processGameResults function...');

// Path to the gameLogicService.js file
const filePath = path.join(__dirname, 'services', 'gameLogicService.js');

// Read the file content
console.log(`Reading file: ${filePath}`);
let content = fs.readFileSync(filePath, 'utf8');

// Check for duplicate processGameResults function
const functionDeclRegex = /const processGameResults = async \(gameType, duration, periodId\) => \{/g;
const matches = content.match(functionDeclRegex);

if (matches && matches.length > 1) {
  console.log(`Found ${matches.length} declarations of processGameResults function`);
  
  // Create a backup of the original file
  const backupPath = filePath + '.backup';
  fs.writeFileSync(backupPath, content);
  console.log(`Created backup at: ${backupPath}`);
  
  // Find the second occurrence to delete
  const firstIndex = content.indexOf(matches[0]);
  const secondIndex = content.indexOf(matches[1]);
  
  // Find the end of the function by matching closing braces
  let braceCount = 1;
  let endIndex = secondIndex;
  
  // Skip past the function declaration
  endIndex = content.indexOf('{', secondIndex) + 1;
  
  // Find the matching closing brace
  while (braceCount > 0 && endIndex < content.length) {
    if (content[endIndex] === '{') {
      braceCount++;
    } else if (content[endIndex] === '}') {
      braceCount--;
    }
    endIndex++;
  }
  
  // Delete the second function
  console.log(`Removing duplicate function (${secondIndex} to ${endIndex})`);
  content = content.substring(0, secondIndex) + content.substring(endIndex);
  
  // Write the fixed content back to the file
  fs.writeFileSync(filePath, content);
  console.log('Fixed file written successfully');
} else {
  console.log('No duplicate declarations found');
}

console.log('Fix completed!'); 