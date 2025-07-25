const securityConfig = {
    // SSL/TLS Configuration
    ssl: {
        enabled: true,
        cert: process.env.SSL_CERT_PATH,
        key: process.env.SSL_KEY_PATH,
        ca: process.env.SSL_CA_PATH,
        minVersion: 'TLSv1.2',
        ciphers: [
            'ECDHE-ECDSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-ECDSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES256-GCM-SHA384'
        ]
    },

    // Server Hardening
    server: {
        trustProxy: true,
        xPoweredBy: false,
        noSniff: true,
        frameGuard: true,
        dnsPrefetchControl: true,
        ieNoOpen: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    },

    // Firewall Rules
    firewall: {
        enabled: true,
        whitelist: process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [],
        blacklist: process.env.IP_BLACKLIST ? process.env.IP_BLACKLIST.split(',') : ['185.177.72.14'], // Add known attackers
        maxConnections: 1000,
        connectionTimeout: 30000
    },

    // DDoS Protection
    ddos: {
        enabled: true,
        burst: 10,
        limit: 100,
        testMode: process.env.NODE_ENV === 'development'
    },

    // Attack Detection
    attackDetection: {
        enabled: false,
        suspiciousPatterns: [
            /\.git/i,
            /\.env/i,
            /\.config/i,
            /\.ini/i,
            /\.log/i,
            /\.sql/i,
            /\.bak/i,
            /\.backup/i,
            /\.old/i,
            /\.tmp/i,
            /\.temp/i,
            /\/\./i,
            /wp-content/i,
            /wp-admin/i,
            /phpmyadmin/i,
            /adminer/i,
            /\.\./i, // Path traversal
            /union.*select/i,
            /script.*alert/i,
            /<script/i
        ],
        maxAttemptsPerIP: 100,
        blockDuration: 3600, // 1 hour
        autoBlock: true
    },

    // Backup Strategy
    backup: {
        enabled: true,
        schedule: '0 0 * * *', // Daily at midnight
        retention: '30d',
        encryption: true,
        compression: true,
        destinations: process.env.BACKUP_DESTINATIONS ? process.env.BACKUP_DESTINATIONS.split(',') : []
    },

    // Data Encryption
    encryption: {
        algorithm: 'aes-256-gcm',
        key: process.env.ENCRYPTION_KEY,
        ivLength: 16,
        saltLength: 64,
        iterations: 100000
    },

    // Data Retention
    retention: {
        logs: '90d',
        sessions: '30d',
        transactions: '365d',
        backups: '365d'
    },

    // Input Validation
    validation: {
        maxStringLength: 1000,
        maxArrayLength: 100,
        maxObjectDepth: 10,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf']
    },

    // Security Headers
    headers: {
        'Content-Security-Policy': "default-src 'self'; connect-src 'self' wss: ws: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' https:; media-src 'self' https:; object-src 'none'; frame-src 'none'; worker-src 'self'; manifest-src 'self'; prefetch-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
    },

    // Rate Limiting
    rateLimits: {
        ip: {
            points: 100,
            duration: 60, // per minute
            burst: 10
        },
        user: {
            points: 50,
            duration: 60, // per minute
            burst: 5
        },
        message: {
            points: 5,
            duration: 1, // per second
            burst: 2
        },
        connection: {
            maxPerUser: 3,
            maxPerIP: 5
        },
        // Enhanced rate limiting for suspicious activities
        suspicious: {
            points: 3,
            duration: 60, // 3 attempts per minute
            burst: 1
        }
    },

    // Game settings
    game: {
        maxBetAmount: 1000000,
        minBetAmount: 0.97,
        validGameTypes: ['wingo', 'fiveD', 'k3'],
        validDurations: [30, 60, 180, 300, 600],
        maxRoomSize: 1000
    },

    // Token settings
    token: {
        accessTokenExpiry: '1h',
        refreshTokenExpiry: '7d',
        maxRefreshTokens: 5
    }
};

module.exports = securityConfig; 