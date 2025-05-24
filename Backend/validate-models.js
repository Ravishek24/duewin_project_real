// Backend/validate-models.js - Validate all models before startup
const fs = require('fs');
const path = require('path');

console.log('🔍 Model Validation Script');
console.log('========================\n');

const modelsDir = path.join(__dirname, 'models');

// Get all model files
const modelFiles = fs.readdirSync(modelsDir)
    .filter(file => file.endsWith('.js') && file !== 'index.js')
    .sort();

console.log(`📁 Found ${modelFiles.length} model files to validate:\n`);

const issues = [];
const validModels = [];

modelFiles.forEach((file, index) => {
    console.log(`${index + 1}. Validating ${file}...`);
    
    const filePath = path.join(modelsDir, file);
    const fileIssues = [];
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check file naming convention
        const expectedClassName = file.replace('.js', '');
        const classMatch = content.match(/class (\w+) extends Model/);
        
        if (!classMatch) {
            fileIssues.push('❌ No class definition found');
        } else {
            const actualClassName = classMatch[1];
            if (actualClassName !== expectedClassName) {
                fileIssues.push(`❌ Class name mismatch: file=${expectedClassName}, class=${actualClassName}`);
            }
        }
        
        // Check for static init method
        if (!content.includes('static init(')) {
            fileIssues.push('❌ Missing static init() method');
        }
        
        // Check for proper sequelize parameter
        const initMatch = content.match(/static init\(([^)]+)\)/);
        if (initMatch) {
            const param = initMatch[1].trim();
            if (param !== 'sequelize') {
                fileIssues.push(`❌ Init method parameter should be 'sequelize', found '${param}'`);
            }
        }
        
        // Check for proper super.init call
        if (!content.includes('super.init(')) {
            fileIssues.push('❌ Missing super.init() call');
        }
        
        // Check for sequelize parameter usage in super.init
        const superInitMatch = content.match(/super\.init\([^)]+,\s*\{[^}]*sequelize[^}]*\}/s);
        if (!superInitMatch) {
            fileIssues.push('❌ Sequelize instance not passed to super.init()');
        }
        
        // Check for proper module.exports
        if (!content.includes('module.exports =')) {
            fileIssues.push('❌ Missing module.exports');
        }
        
        // Check for legacy patterns that might cause issues
        if (content.includes('sequelize.define(')) {
            fileIssues.push('⚠️ Contains legacy sequelize.define() - might cause conflicts');
        }
        
        // Try to require the module to check for syntax errors
        try {
            delete require.cache[require.resolve(filePath)];
            const ModelClass = require(filePath);
            
            if (typeof ModelClass !== 'function') {
                fileIssues.push('❌ Module does not export a class');
            } else if (typeof ModelClass.init !== 'function') {
                fileIssues.push('❌ Exported class does not have init method');
            }
            
        } catch (requireError) {
            fileIssues.push(`❌ Syntax error: ${requireError.message}`);
        }
        
        if (fileIssues.length === 0) {
            console.log('   ✅ Valid\n');
            validModels.push(file);
        } else {
            console.log('   Issues found:');
            fileIssues.forEach(issue => console.log(`     ${issue}`));
            console.log();
            issues.push({ file, issues: fileIssues });
        }
        
    } catch (error) {
        const issue = `❌ Cannot read file: ${error.message}`;
        console.log(`   ${issue}\n`);
        issues.push({ file, issues: [issue] });
    }
});

// Summary
console.log('📊 VALIDATION SUMMARY');
console.log('====================');
console.log(`✅ Valid models: ${validModels.length}`);
console.log(`❌ Models with issues: ${issues.length}`);

if (issues.length > 0) {
    console.log('\n🚨 MODELS WITH ISSUES:');
    issues.forEach(({ file, issues: fileIssues }) => {
        console.log(`\n📄 ${file}:`);
        fileIssues.forEach(issue => console.log(`  ${issue}`));
    });
}

if (validModels.length > 0) {
    console.log('\n✅ VALID MODELS:');
    validModels.forEach(file => console.log(`  📄 ${file}`));
}

// Check for the specific problematic files
console.log('\n🔍 CHECKING FOR SPECIFIC ISSUES:');

const oldSeamlessFile = path.join(modelsDir, 'seamlessGameSession.js');
const newSeamlessFile = path.join(modelsDir, 'SeamlessGameSession.js');

if (fs.existsSync(oldSeamlessFile)) {
    console.log('❌ OLD FILE EXISTS: seamlessGameSession.js');
    console.log('   This will cause conflicts! Run: rm Backend/models/seamlessGameSession.js');
}

if (fs.existsSync(newSeamlessFile)) {
    console.log('✅ NEW FILE EXISTS: SeamlessGameSession.js');
} else {
    console.log('❌ NEW FILE MISSING: SeamlessGameSession.js');
    console.log('   Create this file with proper PascalCase naming');
}

// Check for potential naming conflicts
const fileNames = modelFiles.map(f => f.toLowerCase());
const duplicates = fileNames.filter((name, index) => fileNames.indexOf(name) !== index);
if (duplicates.length > 0) {
    console.log('❌ NAMING CONFLICTS DETECTED:');
    duplicates.forEach(name => console.log(`   ${name}`));
}

console.log('\n🎯 NEXT STEPS:');
if (issues.length === 0) {
    console.log('✅ All models are valid! You can proceed with starting the server.');
} else {
    console.log('❌ Fix the issues above before starting the server.');
    console.log('🔧 Priority fixes:');
    console.log('   1. Remove old seamlessGameSession.js if it exists');
    console.log('   2. Ensure all models have proper static init() methods');
    console.log('   3. Fix any syntax errors');
}

console.log('\n🚀 Run this validation with: node validate-models.js');

// Exit with error code if issues found
if (issues.length > 0) {
    process.exit(1);
} else {
    process.exit(0);
}