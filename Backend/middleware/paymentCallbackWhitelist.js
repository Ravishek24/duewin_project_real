/**
 * Payment Gateway Callback IP Whitelist Middleware
 * 
 * This middleware ensures that payment callbacks can only be received
 * from trusted payment gateway IP addresses.
 */

// Whitelist of known payment gateway IPs
// Add the official IPs of your payment gateway providers here
const paymentGatewayIPs = {
  // OKPAY (add official IPs from their documentation)
  OKPAY: [
    // Test environment IPs
    '103.242.98.41',    // Example sandbox IP
    '47.242.125.119',   // Example sandbox IP
    '47.243.175.82',    // Example sandbox IP
    // Production environment IPs
    '103.45.102.41',    // Example production IP
    '47.57.245.224',    // Example production IP
    // Always include localhost for testing
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1'
  ],
  // WePayGlobal (add official IPs from their documentation)
  WEPAY: [
    // Test environment IPs
    '103.242.98.41',  
    // Production environment IPs
    '103.45.102.41',
    // Always include localhost for testing
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1'
  ],
  // Add more payment gateways as needed
};

// For now, use a combined whitelist
const combinedWhitelist = [
  ...new Set([
    ...paymentGatewayIPs.OKPAY,
    ...paymentGatewayIPs.WEPAY,
    // Always include your server's IP
    process.env.SERVER_IP || '51.21.47.178',
    // Add EC2 instance IP
    '51.21.47.178',
    // Add other trusted IPs
    process.env.TRUSTED_IP1 || '',
    process.env.TRUSTED_IP2 || ''
  ].filter(ip => ip)) // Remove empty strings
];

/**
 * Middleware to verify that callbacks come from whitelisted IPs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const paymentCallbackWhitelist = (req, res, next) => {
  // Get the real IP address (considering proxy headers)
  const clientIP = req.headers['x-forwarded-for'] || 
                  req.headers['x-real-ip'] || 
                  req.connection.remoteAddress;
                  
  // Extract just the IP address if it's in the form "IP:port"
  const ipAddress = clientIP ? clientIP.split(',')[0].trim().split(':').pop() : '';
  
  // Log the incoming IP for debugging
  console.log(`Payment callback received from IP: ${ipAddress}`);

  // Skip IP check in development mode if configured
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_PAYMENT_IP_CHECK === 'true') {
    console.log('IP whitelist check skipped in development mode');
    return next();
  }

  // Check if the IP is whitelisted
  if (!combinedWhitelist.includes(ipAddress)) {
    console.warn(`Unauthorized payment callback from IP: ${ipAddress}`);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Your IP is not authorized for payment callbacks.'
    });
  }

  next();
};

module.exports = {
  paymentCallbackWhitelist,
  paymentGatewayIPs
}; 