# Security Headers Troubleshooting Guide

## Problem: Security Headers Not Detected by External Tools

If your security headers are working locally but not detected by external security scanning tools, follow this troubleshooting guide.

## Quick Diagnosis

### 1. Test Local Headers
```bash
# Test locally
curl -I http://localhost:8000/health

# Test security endpoint
curl -I http://localhost:8000/security-test
```

### 2. Test External Access
```bash
# Test from external IP (replace with your server IP)
curl -I http://YOUR_SERVER_IP:8000/health
```

## Common Issues and Solutions

### Issue 1: Proxy/Load Balancer Stripping Headers

**Symptoms**: Headers work locally but not externally

**Solutions**:

#### For Nginx:
```nginx
# Add to your nginx.conf or site configuration
location / {
    proxy_pass http://localhost:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Preserve security headers
    proxy_hide_header X-Powered-By;
    proxy_pass_header X-Frame-Options;
    proxy_pass_header X-Content-Type-Options;
    proxy_pass_header Content-Security-Policy;
    proxy_pass_header Referrer-Policy;
    proxy_pass_header Permissions-Policy;
    proxy_pass_header Strict-Transport-Security;
    proxy_pass_header X-XSS-Protection;
}
```

#### For Apache:
```apache
# Add to your .htaccess or virtual host configuration
ProxyPass / http://localhost:8000/
ProxyPassReverse / http://localhost:8000/

# Preserve security headers
ProxyPassReverse / http://localhost:8000/
Header always set X-Frame-Options "DENY"
Header always set X-Content-Type-Options "nosniff"
Header always set Content-Security-Policy "default-src 'self'"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
Header unset X-Powered-By
```

#### For Cloud Load Balancers (AWS ALB, GCP LB, etc.):
- Configure the load balancer to preserve custom headers
- Add security headers at the load balancer level if needed

### Issue 2: CORS Interference

**Symptoms**: Headers are set but not visible due to CORS

**Solution**: Update CORS configuration to allow security headers:

```javascript
const corsOptions = {
    origin: function (origin, callback) {
        // Your existing origin logic
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization',
        'X-Spribe-Client-ID',
        'X-Spribe-Client-TS', 
        'X-Spribe-Client-Signature'
    ],
    exposedHeaders: [
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy'
    ],
    credentials: true,
    optionsSuccessStatus: 200
};
```

### Issue 3: Environment Variables Not Set

**Symptoms**: Headers are missing or have default values

**Solution**: Ensure environment variables are properly set:

```bash
# Add to your .env file
NODE_ENV=production
SECURITY_HEADERS_ENABLED=true
```

### Issue 4: Middleware Order

**Symptoms**: Headers are being overridden

**Solution**: Ensure security middleware is applied early:

```javascript
// In your index.js
app.use(cors(corsOptions));
securityMiddleware(app); // Must come before other middleware
app.use(express.json({ limit: '10mb' }));
```

## Testing Tools

### 1. Online Security Headers Checkers
- [Security Headers](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [SSL Labs](https://www.ssllabs.com/ssltest/)

### 2. Command Line Tools
```bash
# Test with curl
curl -I -H "User-Agent: Mozilla/5.0" https://your-domain.com/health

# Test with wget
wget --server-response --spider https://your-domain.com/health

# Test with openssl (for HTTPS)
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

### 3. Browser Developer Tools
1. Open Developer Tools (F12)
2. Go to Network tab
3. Make a request to your API
4. Click on the request and check Response Headers

## Debug Mode

Enable debug logging to see what's happening:

```javascript
// Add to your security middleware
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log('🔍 Request Headers:', req.headers);
        console.log('🔍 Response Headers:', res.getHeaders());
        next();
    });
}
```

## Production Checklist

- [ ] HTTPS is enabled
- [ ] Security headers are set
- [ ] Headers are preserved by proxy/load balancer
- [ ] CORS is properly configured
- [ ] Environment variables are set
- [ ] Middleware order is correct
- [ ] Headers are tested externally

## Emergency Fix

If you need a quick fix, add headers directly in your main route:

```javascript
app.use((req, res, next) => {
    // Force set critical headers
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.removeHeader('X-Powered-By');
    next();
});
```

## Monitoring

Set up monitoring to ensure headers are always present:

```javascript
// Add to your error handling middleware
app.use((req, res, next) => {
    const criticalHeaders = [
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy'
    ];
    
    const missingHeaders = criticalHeaders.filter(header => 
        !res.getHeader(header)
    );
    
    if (missingHeaders.length > 0) {
        console.error('🚨 Missing security headers:', missingHeaders);
    }
    
    next();
});
```

## Contact Support

If you're still having issues:
1. Check your server logs for errors
2. Verify your proxy configuration
3. Test with different tools
4. Ensure your domain is accessible externally 