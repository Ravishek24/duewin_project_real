const { exec } = require('child_process');
const path = require('path');

console.log('🔄 Restarting application with Redis pipeline fix...');

// Check if we're in the backend directory
const currentDir = process.cwd();
const backendDir = path.join(currentDir, 'Backend');

if (currentDir.endsWith('Backend')) {
    console.log('✅ Already in Backend directory');
} else if (require('fs').existsSync(backendDir)) {
    console.log('📁 Switching to Backend directory...');
    process.chdir(backendDir);
} else {
    console.error('❌ Backend directory not found');
    process.exit(1);
}

// Test the Redis pipeline fix first
console.log('\n🧪 Testing Redis pipeline fix...');
exec('node scripts/test-redis-pipeline-fix.js', (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Redis pipeline test failed:', error.message);
        console.error('stderr:', stderr);
        process.exit(1);
    }
    
    console.log('✅ Redis pipeline test passed');
    console.log(stdout);
    
    // Restart the application
    console.log('\n🔄 Restarting application...');
    
    // Try different restart methods
    const restartCommands = [
        'pm2 restart all',
        'pm2 restart strike-backend',
        'npm restart',
        'node index.js'
    ];
    
    let restartAttempted = false;
    
    for (const command of restartCommands) {
        console.log(`🔄 Trying: ${command}`);
        
        exec(command, (restartError, restartStdout, restartStderr) => {
            if (restartError && !restartAttempted) {
                console.log(`⚠️ ${command} failed, trying next method...`);
                return;
            }
            
            if (!restartAttempted) {
                restartAttempted = true;
                console.log('✅ Application restart initiated');
                console.log('stdout:', restartStdout);
                if (restartStderr) {
                    console.log('stderr:', restartStderr);
                }
                
                console.log('\n🎉 Application restarted successfully with Redis pipeline fix!');
                console.log('📊 Monitor the logs to ensure bet processing is working correctly.');
            }
        });
        
        // Wait a bit before trying the next command
        setTimeout(() => {}, 2000);
    }
}); 