// Script to fix security headers issue by removing dependency on utils/securityHeaders
const fs = require('fs');
const path = require('path');

const registerControllerPath = path.join(__dirname, '../controllers/userController/registerController.js');

console.log('Reading register controller file:', registerControllerPath);
let registerContent = fs.readFileSync(registerControllerPath, 'utf8');

// Replace import statement
registerContent = registerContent.replace(
  "const { setSecurityHeaders } = require('../../utils/securityHeaders');", 
  "// Security headers implemented inline"
);

// Add inline security headers function
const securityHeadersFunction = `
// Inline security headers function
const setSecurityHeaders = (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
};
`;

// Insert security headers function before controller function
registerContent = registerContent.replace(
  "const registerController = async (req, res) =>",
  securityHeadersFunction + "\nconst registerController = async (req, res) =>"
);

console.log('Writing updated register controller file');
fs.writeFileSync(registerControllerPath, registerContent, 'utf8');
console.log('✅ Register controller updated successfully');

console.log('Restarting server...');
const { execSync } = require('child_process');
try {
  execSync('pm2 restart duewin-backend');
  console.log('✅ Server restarted successfully');
} catch (error) {
  console.error('Error restarting server:', error);
} 