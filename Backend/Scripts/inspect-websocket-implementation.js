/**
 * WebSocket Implementation Inspector
 * 
 * This script analyzes the WebSocket implementation in the server code
 * and reports on potential issues.
 * 
 * Usage:
 * node scripts/inspect-websocket-implementation.js
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const readDir = promisify(fs.readdir);

// Configuration
const WEBSOCKET_FILES = [
  '../services/websocketService.js',
  '../controllers/gameController.js',
  '../index.js'
];

// Store findings
const findings = {
  implementations: [],
  messageHandlers: [],
  gameTypes: [],
  issues: []
};

async function scanFile(relativePath) {
  try {
    const filePath = path.resolve(__dirname, relativePath);
    console.log(`Scanning ${path.basename(relativePath)}...`);
    
    if (!fs.existsSync(filePath)) {
      findings.issues.push(`File not found: ${relativePath}`);
      return;
    }
    
    const content = await readFile(filePath, 'utf8');
    
    // Look for WebSocket initialization
    if (content.includes('new WebSocket.Server') || content.includes('new ws.Server') || content.includes('new Server(')) {
      findings.implementations.push({
        file: relativePath,
        type: 'server'
      });
    }
    
    // Look for Socket.IO initialization
    if (content.includes('require("socket.io")') || content.includes("require('socket.io')")) {
      findings.implementations.push({
        file: relativePath,
        type: 'socket.io'
      });
    }
    
    // Look for connection handlers
    const connectionMatches = content.match(/(on\(['"]connection['"],\s*.*?\))/gs);
    if (connectionMatches) {
      findings.implementations.push({
        file: relativePath,
        type: 'connection_handler',
        matches: connectionMatches.length
      });
    }
    
    // Look for message handlers
    const messageMatches = content.match(/(on\(['"]message['"],\s*.*?\))/gs);
    if (messageMatches) {
      findings.messageHandlers.push({
        file: relativePath,
        matches: messageMatches.length
      });
    }
    
    // Look for game types
    const gameTypeMatches = content.match(/['"]gameType['"]\s*:\s*['"](\w+)['"]/g);
    if (gameTypeMatches) {
      const types = new Set(
        gameTypeMatches.map(match => {
          const m = match.match(/['"](\w+)['"]/g);
          return m ? m[1]?.replace(/['"]/g, '') : null;
        }).filter(Boolean)
      );
      findings.gameTypes.push(...types);
    }
    
    // Look for joinGame handlers
    const joinGameMatches = content.match(/(on\(['"]joinGame['"],\s*.*?\))/gs);
    if (joinGameMatches) {
      findings.messageHandlers.push({
        file: relativePath,
        type: 'joinGame',
        matches: joinGameMatches.length
      });
    }
    
  } catch (error) {
    findings.issues.push(`Error scanning ${relativePath}: ${error.message}`);
  }
}

async function scanDirectory(dir) {
  try {
    const dirPath = path.resolve(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      findings.issues.push(`Directory not found: ${dir}`);
      return [];
    }
    
    const entries = await readDir(dirPath, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
      .map(entry => path.join(dir, entry.name));
    
    return files;
  } catch (error) {
    findings.issues.push(`Error scanning directory ${dir}: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('===== WEBSOCKET IMPLEMENTATION INSPECTOR =====\n');
  
  // Scan specific WebSocket files
  for (const filePath of WEBSOCKET_FILES) {
    await scanFile(filePath);
  }
  
  // Scan services directory
  const serviceFiles = await scanDirectory('../services');
  for (const filePath of serviceFiles) {
    await scanFile(filePath);
  }
  
  // Report findings
  console.log('\n===== SCAN RESULTS =====\n');
  
  console.log('WebSocket Implementations:');
  if (findings.implementations.length === 0) {
    console.log('  No WebSocket implementations found!');
  } else {
    findings.implementations.forEach(impl => {
      console.log(`  - ${impl.file} (${impl.type})`);
    });
  }
  
  console.log('\nMessage Handlers:');
  if (findings.messageHandlers.length === 0) {
    console.log('  No message handlers found!');
  } else {
    findings.messageHandlers.forEach(handler => {
      console.log(`  - ${handler.file}${handler.type ? ` (${handler.type})` : ''}: ${handler.matches} handlers`);
    });
  }
  
  console.log('\nGame Types Found:');
  if (findings.gameTypes.length === 0) {
    console.log('  No game types found!');
  } else {
    findings.gameTypes.forEach(type => {
      console.log(`  - ${type}`);
    });
  }
  
  console.log('\nPotential Issues:');
  if (findings.issues.length === 0) {
    console.log('  No issues found in scan.');
  } else {
    findings.issues.forEach(issue => {
      console.log(`  - ${issue}`);
    });
  }
  
  // Provide recommendations
  console.log('\n===== RECOMMENDATIONS =====\n');
  
  if (findings.implementations.length === 0) {
    console.log('✘ No WebSocket implementation found. Add WebSocket support to your server.');
  } else {
    console.log('✓ WebSocket implementation found.');
  }
  
  if (findings.messageHandlers.length === 0) {
    console.log('✘ No message handlers found. Add handlers for client messages.');
  } else {
    console.log('✓ Message handlers found.');
  }
  
  if (findings.issues.length > 0) {
    console.log('⚠️ Issues were found in the scan. Please review them above.');
  }
  
  console.log('\n===== DEBUGGING STEPS =====\n');
  console.log('1. Check if WebSocket server is correctly initialized');
  console.log('2. Verify message handlers are registering correctly');
  console.log('3. Add console logs to track message flow');
  console.log('4. Check authentication middleware for WebSocket connections');
  console.log('5. Ensure game room joining logic is working');
  
  console.log('\n======================================');
}

// Run the main function
main().catch(error => {
  console.error('Error running inspector:', error);
  process.exit(1);
}); 