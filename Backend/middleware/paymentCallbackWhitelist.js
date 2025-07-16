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
    ////////////////////////
    '27.124.46.151',    // Example sandbox IP
    '202.79.174.166', 
    ////////////////////////  // Example sandbox IP
    '47.243.175.82',    // Example sandbox IP
    // Production environment IPs
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
  // 101pay (add official IPs from their documentation)
  '101PAY': [
    // Add 101pay IP addresses here
    // You'll need to get these from 101pay support or documentation
    'api.oneoonepay.org', // Domain-based check (if supported)
    // Add actual IP addresses when available
  ],
  // Add more payment gateways as needed
};

// For now, use a combined whitelist
const combinedWhitelist = [
  ...new Set([
    ...paymentGatewayIPs.OKPAY,
    ...paymentGatewayIPs.WEPAY,
    ...paymentGatewayIPs['101PAY'],
    // Always include your server's IP
    process.env.SERVER_IP || '51.21.47.178',

    '194.61.40.62',
    ' 194.61.40.65',
    '194.61.40.92',
    '194.61.40.97',
    '194.61.40.102',
    '194.61.40.112',
    '194.61.40.122',
    '194.61.40.132',
    '194.61.40.142',
    '194.61.40.152',
    // Add EC2 instance IP
    '51.21.47.178',
    // Add other trusted IPs
    process.env.TRUSTED_IP1 || '',
    process.env.TRUSTED_IP2 || '',
    // Add your current IP for testing (replace with your actual IP)
    'YOUR_CURRENT_IP_HERE', // Replace this with your actual IP address
    // Add the new IP addresses for payment callbacks
    '122.161.49.155',
    '172.31.41.86',
    // Combine IP of gateways to send callbacks
    //////////////////////
    '13.228.129.142', //// L Pay
    //////////////////////

    '27.124.45.41',
    
    //////////////////////
    '13.228.129.142', //// L Pay
    //////////////////////

    //////////////////////
    '3.1.16.96', //// Ppaypro
    '52.221.132.176', //// Paypro
    //////////////////////

    //////////////////////
    '47.245.107.148', //// USDT wg pay
    '8.219.120.86', //// USDT wg pay
    //////////////////////

    //////////////////////
    '86.38.247.84', //// CH Pay
    'fe80::be24:11ff:feb8:ed4c', //// CH Pay
    '146.103.45.221', //// CH Pay
    '140.99.130.55', //// CH Pay
    '216.107.138.95', //// CH Pay
    //////////////////////

    //////////////////////
    '34.93.160.199',
    '34.100.152.58', //// 101pay
    //////////////////////



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