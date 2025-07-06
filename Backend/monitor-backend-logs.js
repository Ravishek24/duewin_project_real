const { spawn } = require('child_process');
const readline = require('readline');

function monitorBackendLogs() {
    console.log('📡 [LOG_MONITOR] ==========================================');
    console.log('📡 [LOG_MONITOR] Starting real-time backend log monitoring');
    console.log('📡 [LOG_MONITOR] ==========================================');
    console.log('📡 [LOG_MONITOR] Monitoring for protection-related logs...');
    console.log('📡 [LOG_MONITOR] Place a bet and watch the logs below:');
    console.log('📡 [LOG_MONITOR] ==========================================\n');

    // Start the backend server with log monitoring
    const backendProcess = spawn('node', ['index.js'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: __dirname
    });

    // Create readline interface for stdout
    const stdout = readline.createInterface({
        input: backendProcess.stdout,
        crlfDelay: Infinity
    });

    // Create readline interface for stderr
    const stderr = readline.createInterface({
        input: backendProcess.stderr,
        crlfDelay: Infinity
    });

    // Monitor stdout for protection-related logs
    stdout.on('line', (line) => {
        if (line.includes('[PROTECTION') || 
            line.includes('[USER_COUNT') || 
            line.includes('[RESULT') || 
            line.includes('[PROCESS') ||
            line.includes('selectProtectedResultWithExposure') ||
            line.includes('getUniqueUserCount') ||
            line.includes('calculateResultWithVerification') ||
            line.includes('processGameResults')) {
            console.log(`📡 [STDOUT] ${line}`);
        }
    });

    // Monitor stderr for protection-related logs
    stderr.on('line', (line) => {
        if (line.includes('[PROTECTION') || 
            line.includes('[USER_COUNT') || 
            line.includes('[RESULT') || 
            line.includes('[PROCESS') ||
            line.includes('selectProtectedResultWithExposure') ||
            line.includes('getUniqueUserCount') ||
            line.includes('calculateResultWithVerification') ||
            line.includes('processGameResults')) {
            console.log(`📡 [STDERR] ${line}`);
        }
    });

    // Handle process exit
    backendProcess.on('close', (code) => {
        console.log(`📡 [LOG_MONITOR] Backend process exited with code ${code}`);
    });

    // Handle process errors
    backendProcess.on('error', (error) => {
        console.error(`📡 [LOG_MONITOR] Backend process error:`, error);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n📡 [LOG_MONITOR] Shutting down...');
        backendProcess.kill('SIGINT');
        process.exit(0);
    });
}

// Alternative: Monitor existing log files
function monitorLogFiles() {
    console.log('📡 [LOG_MONITOR] ==========================================');
    console.log('📡 [LOG_MONITOR] Monitoring existing log files');
    console.log('📡 [LOG_MONITOR] ==========================================');
    console.log('📡 [LOG_MONITOR] If you have log files, they will be monitored here');
    console.log('📡 [LOG_MONITOR] ==========================================\n');

    // You can add log file monitoring here if you have log files
    console.log('📡 [LOG_MONITOR] No log files found. Use the real-time monitoring instead.');
}

// Check if backend is already running
function checkBackendStatus() {
    const { exec } = require('child_process');
    exec('ps aux | grep "node.*index.js" | grep -v grep', (error, stdout, stderr) => {
        if (stdout) {
            console.log('📡 [LOG_MONITOR] Backend is already running. Monitoring existing process...');
            monitorLogFiles();
        } else {
            console.log('📡 [LOG_MONITOR] Backend not running. Starting with monitoring...');
            monitorBackendLogs();
        }
    });
}

checkBackendStatus(); 