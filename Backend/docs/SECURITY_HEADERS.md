# Security Headers Implementation Guide

## Overview

This document explains the security headers implemented in the DueWin Backend to protect against various web vulnerabilities and attacks.

## Implemented Security Headers

### 1. Content-Security-Policy (CSP)
**Purpose**: Protects against XSS attacks by controlling which resources can be loaded.

**Value**: `default-src 'self'; connect-src 'self' wss: ws: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' https:; media-src 'self' https:; object-src 'none'; frame-src 'none'; worker-src 'self'; manifest-src 'self'; prefetch-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;`

**Security Benefits**:
- Prevents XSS attacks by controlling script execution
- Blocks malicious resource loading
- Prevents clickjacking via frame-ancestors
- Forces HTTPS connections

### 2. X-Frame-Options
**Purpose**: Prevents clickjacking attacks by controlling iframe embedding.

**Value**: `DENY`

**Security Benefits**:
- Prevents your site from being embedded in iframes
- Protects against clickjacking attacks
- Ensures content is only displayed in its intended context

### 3. X-Content-Type-Options
**Purpose**: Prevents MIME type sniffing attacks.

**Value**: `nosniff`

**Security Benefits**:
- Forces browsers to respect the declared content type
- Prevents MIME confusion attacks
- Reduces risk of XSS through content type manipulation

### 4. Referrer-Policy
**Purpose**: Controls how much referrer information is sent with requests.

**Value**: `strict-origin-when-cross-origin`

**Security Benefits**:
- Limits information leakage through referrer headers
- Protects user privacy
- Prevents sensitive data exposure in URLs

### 5. Permissions-Policy
**Purpose**: Controls which browser features and APIs can be used.

**Value**: `geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()`

**Security Benefits**:
- Restricts access to sensitive browser APIs
- Prevents unauthorized access to device features
- Enhances privacy protection

### 6. X-XSS-Protection
**Purpose**: Enables browser's built-in XSS protection.

**Value**: `1; mode=block`

**Security Benefits**:
- Provides additional XSS protection layer
- Blocks rendering of pages with detected XSS
- Works alongside CSP for comprehensive protection

### 7. Strict-Transport-Security (HSTS)
**Purpose**: Forces HTTPS connections and prevents protocol downgrade attacks.

**Value**: `max-age=31536000; includeSubDomains; preload`

**Security Benefits**:
- Ensures all connections use HTTPS
- Prevents man-in-the-middle attacks
- Protects against protocol downgrade attacks

### 8. X-Permitted-Cross-Domain-Policies
**Purpose**: Controls cross-domain policy files.

**Value**: `none`

**Security Benefits**:
- Prevents unauthorized cross-domain access
- Restricts policy file usage
- Enhances domain isolation

### 9. Cross-Origin-Opener-Policy
**Purpose**: Controls how the browser handles cross-origin windows.

**Value**: `same-origin`

**Security Benefits**:
- Prevents cross-origin window manipulation
- Protects against cross-origin attacks
- Enhances window isolation

### 10. Cross-Origin-Embedder-Policy
**Purpose**: Controls cross-origin resource embedding.

**Value**: `require-corp`

**Security Benefits**:
- Requires explicit permission for cross-origin resources
- Prevents unauthorized resource embedding
- Enhances resource isolation

## Additional Security Measures

### X-Powered-By Removal
- Removes the `X-Powered-By` header to hide server technology information
- Prevents information disclosure attacks

### Security Logging
- Logs security-relevant requests (bots, admin access, etc.)
- Helps with security monitoring and incident response

## Testing Security Headers

### Manual Testing
```bash
# Test security headers
npm run test-security

# Or run directly
node test-security-headers.js
```

### Using curl
```bash
curl -I http://localhost:8000/health
```

### Using Browser Developer Tools
1. Open Developer Tools (F12)
2. Go to Network tab
3. Make a request to your API
4. Check the Response Headers section

## Security Recommendations

### 1. HTTPS in Production
- Always use HTTPS in production environments
- Configure SSL/TLS certificates properly
- Use strong cipher suites

### 2. Regular Updates
- Keep dependencies updated
- Monitor security advisories
- Apply security patches promptly

### 3. Monitoring
- Monitor security logs regularly
- Set up alerts for suspicious activities
- Review access patterns

### 4. Rate Limiting
- Implement rate limiting for API endpoints
- Protect against brute force attacks
- Monitor for unusual traffic patterns

### 5. Environment Variables
- Use environment variables for sensitive data
- Never hardcode secrets in code
- Use secure secret management

## Configuration

All security headers are configured in `config/securityConfig.js` and applied through `middleware/securityMiddleware.js`.

### Customizing Headers
To modify security headers, edit the `headers` object in `securityConfig.js`:

```javascript
headers: {
    'Content-Security-Policy': 'your-csp-policy',
    'X-Frame-Options': 'your-frame-options',
    // ... other headers
}
```

### Environment-Specific Configuration
You can make headers conditional based on environment:

```javascript
headers: {
    'Strict-Transport-Security': process.env.NODE_ENV === 'production' 
        ? 'max-age=31536000; includeSubDomains; preload' 
        : undefined
}
```

## Troubleshooting

### Common Issues

1. **CSP Blocking Resources**
   - Check browser console for CSP violations
   - Adjust CSP directives as needed
   - Use `report-uri` directive for monitoring

2. **CORS Conflicts**
   - Ensure CORS and CSP policies are compatible
   - Check for conflicting security policies

3. **HTTPS Requirements**
   - Ensure all resources use HTTPS
   - Check for mixed content warnings

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` to see detailed security middleware logs.

## Compliance

These security headers help achieve compliance with:
- OWASP Top 10
- PCI DSS requirements
- GDPR privacy requirements
- Various security standards

## References

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) 