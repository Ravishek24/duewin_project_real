// List of IPs that are exempt from rate limiting
const whitelistedIPs = [
    '51.21.47.178',  // EC2 instance
    '127.0.0.1',     // Localhost
    '::1',           // IPv6 localhost
    '::ffff:127.0.0.1', // IPv4 mapped to IPv6 localhost
    '122.161.48.79',  // Local IP
    '172.31.41.86',  // Server IP
    'YOUR_IP_HERE'   // Your IP address
];

module.exports = {
    whitelistedIPs,
    isWhitelisted: (ip) => whitelistedIPs.includes(ip)
}; 