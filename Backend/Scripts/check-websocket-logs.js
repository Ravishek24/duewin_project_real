/**
 * WebSocket Log Checker
 * 
 * Scans logs for WebSocket-related errors and connection issues
 * 
 * Usage:
 * node scripts/check-websocket-logs.js [log_file_path]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Default log paths to check
const DEFAULT_LOG_PATHS = [
  '../logs/error.log',
  '../logs/app.log',
  '../logs/server.log',
  '../logs/combined.log',
  '/var/log/nginx/error.log',
  '/var/log/nginx/access.log'
];

// Get log file path from command line args
const logPath = process.argv[2];

console.log('===== WEBSOCKET LOG CHECKER =====');

// If a specific log file is provided, check only that one
if (logPath) {
  checkLogFile(logPath);
} else {
  console.log('\nNo specific log file provided, checking default log locations...');
  
  // Check all default log paths
  let foundLogs = false;
  for (const defaultPath of DEFAULT_LOG_PATHS) {
    try {
      const resolvedPath = path.resolve(__dirname, defaultPath);
      if (fs.existsSync(resolvedPath)) {
        console.log(`\nFound log file: ${resolvedPath}`);
        checkLogFile(resolvedPath);
        foundLogs = true;
      }
    } catch (err) {
      // Skip inaccessible files
    }
  }
  
  if (!foundLogs) {
    console.log('❌ No log files found in default locations.');
    console.log('Please specify a log file path:');
    console.log('node scripts/check-websocket-logs.js /path/to/logfile');
  }
}

/**
 * Check a log file for WebSocket-related errors
 * @param {string} filePath - Path to log file
 */
async function checkLogFile(filePath) {
  try {
    console.log(`\nScanning ${filePath} for WebSocket issues...`);
    
    // Check if file exists and is accessible
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Log file not found: ${filePath}`);
      return;
    }
    
    // Define search patterns
    const patterns = [
      { regex: /WebSocket.*error/i, type: 'WebSocket Error' },
      { regex: /socket.*error/i, type: 'Socket Error' },
      { regex: /connection.*error/i, type: 'Connection Error' },
      { regex: /proxy.*error/i, type: 'Proxy Error' },
      { regex: /nginx.*websocket/i, type: 'NGINX WebSocket' },
      { regex: /502 Bad Gateway/i, type: '502 Bad Gateway' },
      { regex: /504 Gateway Timeout/i, type: '504 Gateway Timeout' },
      { regex: /Redis.*error/i, type: 'Redis Error' },
      { regex: /token.*expired/i, type: 'Token Expired' },
      { regex: /invalid token/i, type: 'Invalid Token' },
      { regex: /authentication.*failed/i, type: 'Auth Failure' },
      { regex: /Error handling message/i, type: 'Message Error' }
    ];
    
    // Create readline interface
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    // Track findings
    let totalMatches = 0;
    const findings = {};
    const recentErrors = [];
    
    // Process each line
    let lineNumber = 0;
    for await (const line of rl) {
      lineNumber++;
      
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Check each pattern
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          // Initialize counter if first match of this type
          if (!findings[pattern.type]) {
            findings[pattern.type] = 0;
          }
          
          // Increment counter
          findings[pattern.type]++;
          totalMatches++;
          
          // Store recent errors (last 10 only)
          if (recentErrors.length < 10) {
            recentErrors.push({
              line: lineNumber,
              type: pattern.type,
              text: line
            });
          }
          
          // Only count each line once, even if multiple patterns match
          break;
        }
      }
    }
    
    // Report results
    console.log(`\nScan complete. Found ${totalMatches} WebSocket-related issues.`);
    
    if (totalMatches > 0) {
      // Print summary by error type
      console.log('\n=== Error Type Summary ===');
      for (const [type, count] of Object.entries(findings)) {
        console.log(`${type}: ${count} occurrences`);
      }
      
      // Print recent errors
      console.log('\n=== Recent Error Details ===');
      recentErrors.forEach(error => {
        console.log(`\nLine ${error.line} - ${error.type}:`);
        console.log(`> ${error.text.trim()}`);
      });
      
      // Provide recommendations
      console.log('\n=== Recommendations ===');
      
      if (findings['502 Bad Gateway'] || findings['504 Gateway Timeout']) {
        console.log('1. Check NGINX configuration for WebSocket proxy settings:');
        console.log('   - Ensure proxy_http_version 1.1 is set');
        console.log('   - Verify proxy_set_header Upgrade $http_upgrade;');
        console.log('   - Verify proxy_set_header Connection "upgrade";');
        console.log('   - Check proxy timeouts (proxy_read_timeout, proxy_connect_timeout)');
      }
      
      if (findings['Redis Error']) {
        console.log('2. Redis connection issues:');
        console.log('   - Verify Redis is running and accessible');
        console.log('   - Check Redis connection string in environment variables');
        console.log('   - Consider disabling Redis adapter temporarily for testing');
      }
      
      if (findings['Token Expired'] || findings['Invalid Token'] || findings['Auth Failure']) {
        console.log('3. Authentication issues:');
        console.log('   - Generate a fresh token for testing');
        console.log('   - Verify JWT_SECRET is consistent between token generation and verification');
        console.log('   - Check token payload format (userId vs id field)');
      }
      
      if (findings['WebSocket Error'] || findings['Socket Error']) {
        console.log('4. WebSocket implementation:');
        console.log('   - Check which implementation (ws or socket.io) is active on the server');
        console.log('   - Ensure client is connecting to the right implementation');
        console.log('   - Verify correct paths and query parameters');
      }
    } else {
      console.log('✅ No WebSocket-related issues found in this log file.');
    }
    
  } catch (error) {
    console.error(`❌ Error scanning log file: ${error.message}`);
  }
} 