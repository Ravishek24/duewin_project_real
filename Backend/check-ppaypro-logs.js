const fs = require('fs');
const path = require('path');

// Check PPayPro callback logs
function checkPpayProLogs() {
    console.log('📋 Checking PPayPro Callback Logs...\n');
    
    const logFile = path.join(__dirname, 'logs', 'ppaypro-callbacks.log');
    
    if (!fs.existsSync(logFile)) {
        console.log('❌ No PPayPro callback log file found');
        console.log('Expected location:', logFile);
        return;
    }
    
    try {
        const logContent = fs.readFileSync(logFile, 'utf8');
        console.log('✅ Found PPayPro callback log file');
        console.log('📄 Log content:');
        console.log('='.repeat(80));
        console.log(logContent);
        console.log('='.repeat(80));
        
        // Count callbacks
        const callbackCount = (logContent.match(/PPayPro Callback Received/g) || []).length;
        console.log(`\n📊 Total callbacks received: ${callbackCount}`);
        
    } catch (error) {
        console.error('❌ Error reading log file:', error.message);
    }
}

// Check server logs for PPayPro errors
function checkServerLogs() {
    console.log('\n🔍 Checking Server Logs for PPayPro Errors...\n');
    
    const logsDir = path.join(__dirname, 'logs');
    
    if (!fs.existsSync(logsDir)) {
        console.log('❌ No logs directory found');
        return;
    }
    
    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter(file => file.endsWith('.log'));
    
    console.log('📁 Found log files:', logFiles);
    
    logFiles.forEach(file => {
        const filePath = path.join(logsDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const ppayproLines = content.split('\n').filter(line => 
                line.toLowerCase().includes('ppaypro') || 
                line.toLowerCase().includes('ppay')
            );
            
            if (ppayproLines.length > 0) {
                console.log(`\n📄 PPayPro related entries in ${file}:`);
                ppayproLines.forEach(line => console.log('  ', line));
            }
        } catch (error) {
            console.error(`❌ Error reading ${file}:`, error.message);
        }
    });
}

// Check environment variables
function checkEnvironment() {
    console.log('\n🔧 Checking PPayPro Environment Variables...\n');
    
    const envVars = [
        'PPAYPRO_MCH_NO',
        'PPAYPRO_APP_ID', 
        'PPAYPRO_KEY',
        'PPAYPRO_HOST'
    ];
    
    envVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: ${varName.includes('KEY') ? '***HIDDEN***' : value}`);
        } else {
            console.log(`❌ ${varName}: Not set`);
        }
    });
}

// Main function
function main() {
    console.log('🚀 PPayPro Debug Information\n');
    
    checkEnvironment();
    checkPpayProLogs();
    checkServerLogs();
    
    console.log('\n✅ Debug check completed!');
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    checkPpayProLogs,
    checkServerLogs,
    checkEnvironment
}; 