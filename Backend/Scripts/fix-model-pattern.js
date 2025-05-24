// fix-model-patterns.js
// Run this script to identify models that need to be updated
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');

// Read all model files
const modelFiles = fs.readdirSync(modelsDir)
  .filter(file => file.endsWith('.js') && file !== 'index.js');

console.log('🔍 Checking model patterns...\n');

const problematicModels = [];

modelFiles.forEach(file => {
  const filePath = path.join(modelsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for old sequelize.define pattern
  if (content.includes('sequelize.define(') && !content.includes('class ') && !content.includes('static init(')) {
    problematicModels.push(file);
    console.log(`❌ ${file} - Uses sequelize.define() pattern`);
  }
  // Check for direct require of other models
  else if (content.includes('require(\'./') && content.includes('const ') && content.includes(' = require(')) {
    console.log(`⚠️ ${file} - Has direct model imports (potential circular dependency)`);
  }
  else {
    console.log(`✅ ${file} - Uses proper pattern`);
  }
});

if (problematicModels.length > 0) {
  console.log(`\n📋 Models that need to be updated to class-based pattern:`);
  problematicModels.forEach(model => console.log(`- ${model}`));
  console.log(`\nThese models should be converted to use the class-based pattern like User.js`);
} else {
  console.log(`\n✅ All models use proper patterns!`);
}

console.log('\n🔧 To fix the OtpRequest model specifically, replace it with the fixed version provided.');
console.log('🔧 Other models may also need similar updates to use the class-based pattern.');