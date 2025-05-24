// Backend/diagnostic.js - Debug script to identify the exact issue
const fs = require('fs');
const path = require('path');

console.log('🔍 Starting Sequelize Diagnostic...');

// Step 1: Check if the old camelCase file still exists
const oldFile = path.join(__dirname, 'models', 'seamlessGameSession.js');
const newFile = path.join(__dirname, 'models', 'SeamlessGameSession.js');

console.log('\n📁 File System Check:');
console.log(`Old file (seamlessGameSession.js) exists: ${fs.existsSync(oldFile)}`);
console.log(`New file (SeamlessGameSession.js) exists: ${fs.existsSync(newFile)}`);

if (fs.existsSync(oldFile)) {
    console.log('❌ OLD FILE STILL EXISTS! This is likely causing the issue.');
    console.log('Please run: rm Backend/models/seamlessGameSession.js');
}

// Step 2: Test database configuration
console.log('\n🔧 Testing Database Configuration...');
try {
    const config = require('./config/config.js');
    const env = process.env.NODE_ENV || 'development';
    console.log(`Environment: ${env}`);
    console.log(`Database config exists: ${!!config[env]}`);
    
    if (config[env]) {
        console.log(`Database: ${config[env].database}`);
        console.log(`Host: ${config[env].host}`);
        console.log(`Dialect: ${config[env].dialect}`);
    }
} catch (configError) {
    console.error('❌ Database config error:', configError.message);
}

// Step 3: Test basic Sequelize creation
console.log('\n🔧 Testing Basic Sequelize Creation...');
try {
    const { Sequelize } = require('sequelize');
    const config = require('./config/config.js');
    const env = process.env.NODE_ENV || 'development';
    const dbConfig = config[env];
    
    const testSequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
            host: dbConfig.host,
            dialect: dbConfig.dialect,
            logging: false
        }
    );
    
    console.log('✅ Sequelize instance created successfully');
    console.log(`getQueryInterface available: ${!!testSequelize.getQueryInterface}`);
    console.log(`getQueryInterface type: ${typeof testSequelize.getQueryInterface}`);
    
    if (testSequelize.getQueryInterface) {
        console.log('✅ getQueryInterface is available');
    } else {
        console.log('❌ getQueryInterface is NOT available');
    }
    
    await testSequelize.close();
    
} catch (sequelizeError) {
    console.error('❌ Basic Sequelize creation failed:', sequelizeError.message);
}

// Step 4: Test model files
console.log('\n📄 Testing Model Files...');
const modelsDir = path.join(__dirname, 'models');
const modelFiles = fs.readdirSync(modelsDir)
    .filter(file => file.endsWith('.js') && file !== 'index.js')
    .sort();

console.log(`Found ${modelFiles.length} model files:`);
modelFiles.forEach(file => {
    const filePath = path.join(modelsDir, file);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const hasStaticInit = content.includes('static init(');
        const hasSequelizeDefine = content.includes('sequelize.define(');
        const className = content.match(/class (\w+) extends Model/)?.[1] || 'Unknown';
        
        console.log(`  📄 ${file}:`);
        console.log(`    Class: ${className}`);
        console.log(`    Has static init(): ${hasStaticInit}`);
        console.log(`    Uses sequelize.define(): ${hasSequelizeDefine}`);
        console.log(`    Pattern: ${hasStaticInit ? 'Modern' : hasSequelizeDefine ? 'Legacy' : 'Unknown'}`);
        
        if (file.toLowerCase().includes('seamless')) {
            console.log(`    🔍 SEAMLESS MODEL DETECTED: ${file}`);
        }
        
    } catch (fileError) {
        console.log(`  ❌ ${file}: Error reading file - ${fileError.message}`);
    }
});

// Step 5: Test specific problematic model
console.log('\n🔍 Testing SeamlessGameSession Model Specifically...');
try {
    const { Sequelize } = require('sequelize');
    const config = require('./config/config.js');
    const env = process.env.NODE_ENV || 'development';
    const dbConfig = config[env];
    
    const testSequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
            host: dbConfig.host,
            dialect: dbConfig.dialect,
            logging: false
        }
    );
    
    // Try to connect first
    await testSequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Test if the new SeamlessGameSession file exists and can be loaded
    if (fs.existsSync(newFile)) {
        console.log('📄 Loading SeamlessGameSession model...');
        
        // Clear require cache first
        if (require.cache[require.resolve('./models/SeamlessGameSession')]) {
            delete require.cache[require.resolve('./models/SeamlessGameSession')];
        }
        
        const SeamlessGameSession = require('./models/SeamlessGameSession');
        console.log(`Model loaded: ${typeof SeamlessGameSession}`);
        console.log(`Has init method: ${typeof SeamlessGameSession.init === 'function'}`);
        
        if (typeof SeamlessGameSession.init === 'function') {
            console.log('🔧 Testing model initialization...');
            
            // This is where the error probably occurs
            const initializedModel = SeamlessGameSession.init(testSequelize);
            console.log('✅ Model initialized successfully!');
            console.log(`Initialized model: ${!!initializedModel}`);
        }
    } else {
        console.log('❌ SeamlessGameSession.js file not found!');
    }
    
    await testSequelize.close();
    
} catch (modelError) {
    console.error('❌ SeamlessGameSession model test failed:');
    console.error(`Error: ${modelError.message}`);
    console.error(`Stack: ${modelError.stack}`);
    
    if (modelError.message.includes('getQueryInterface')) {
        console.log('🎯 FOUND THE ISSUE! The getQueryInterface error occurred here.');
        console.log('This means the Sequelize instance passed to the model is undefined or malformed.');
    }
}

// Step 6: Check for circular dependencies
console.log('\n🔄 Checking for Circular Dependencies...');
const checkCircularDeps = (filePath, visited = new Set(), chain = []) => {
    if (visited.has(filePath)) {
        if (chain.includes(filePath)) {
            console.log(`🔄 Circular dependency detected: ${chain.join(' -> ')} -> ${filePath}`);
            return true;
        }
        return false;
    }
    
    visited.add(filePath);
    chain.push(filePath);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const requires = content.match(/require\(['"`]([^'"`]+)['"`]\)/g) || [];
        
        for (const req of requires) {
            const match = req.match(/require\(['"`]([^'"`]+)['"`]\)/);
            if (match) {
                const requiredPath = match[1];
                if (requiredPath.startsWith('./') || requiredPath.startsWith('../')) {
                    const resolvedPath = path.resolve(path.dirname(filePath), requiredPath);
                    if (fs.existsSync(resolvedPath + '.js')) {
                        if (checkCircularDeps(resolvedPath + '.js', visited, [...chain])) {
                            return true;
                        }
                    }
                }
            }
        }
    } catch (error) {
        // Ignore file read errors
    }
    
    chain.pop();
    return false;
};

// Check key files for circular dependencies
const keyFiles = [
    path.join(__dirname, 'models', 'index.js'),
    path.join(__dirname, 'config', 'db.js'),
    path.join(__dirname, 'index.js')
];

keyFiles.forEach(file => {
    if (fs.existsSync(file)) {
        checkCircularDeps(file);
    }
});

console.log('\n✅ Diagnostic completed!');
console.log('\n📋 RECOMMENDATIONS:');
console.log('1. If old seamlessGameSession.js exists, DELETE it');
console.log('2. Make sure SeamlessGameSession.js (PascalCase) exists with proper content');
console.log('3. Check the error location identified above');
console.log('4. Ensure database connection is established BEFORE model initialization');
console.log('\n🚀 Run this diagnostic with: node diagnostic.js');