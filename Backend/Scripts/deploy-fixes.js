#!/usr/bin/env node

/**
 * This script sends updated files to the server and restarts the application
 * 
 * Required files:
 * 1. controllers/userController/registerController.js
 * 2. controllers/userController/loginController.js
 * 3. utils/jwt.js
 * 4. config/config.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const SERVER = 'ubuntu@51.21.47.178';
const SERVER_PATH = '/home/ubuntu/duewin_project_real-main/backend';
const LOCAL_PATH = path.resolve(__dirname, '..');

// Files to update
const filesToUpdate = [
  'controllers/userController/registerController.js',
  'controllers/userController/loginController.js',
  'utils/jwt.js',
  'config/config.js',
];

// Check if files exist locally
console.log('Checking files locally...');
filesToUpdate.forEach(file => {
  const filePath = path.join(LOCAL_PATH, file);
  if (!fs.existsSync(filePath)) {
    console.error(`File doesn't exist: ${filePath}`);
    process.exit(1);
  }
  console.log(`✅ Found ${file}`);
});

// Create SSH commands
const sshCommands = filesToUpdate.map(file => {
  const localFile = path.join(LOCAL_PATH, file);
  const remoteFile = `${SERVER_PATH}/${file}`;
  const remoteDir = path.dirname(remoteFile);
  
  return `ssh ${SERVER} "mkdir -p ${remoteDir}" && scp ${localFile} ${SERVER}:${remoteFile}`;
});

// Add restart command
sshCommands.push(`ssh ${SERVER} "cd ${SERVER_PATH} && pm2 restart duewin-backend"`);

// Execute commands
console.log('Deploying files to server...');
sshCommands.forEach((cmd, index) => {
  console.log(`Running command: ${cmd}`);
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${error}`);
      return;
    }
    if (stderr) {
      console.error(`Command stderr: ${stderr}`);
    }
    if (stdout) {
      console.log(`Command stdout: ${stdout}`);
    }
    
    if (index === sshCommands.length - 1) {
      console.log('✅ Deployment completed successfully!');
    }
  });
}); 