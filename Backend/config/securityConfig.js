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
        blacklist: process.env.IP_BLACKLIST ? process.env.IP_BLACKLIST.split(',') : [],
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
        'Content-Security-Policy': "default-src 'self'; connect-src 'self' wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Cross-Origin-Opener-Policy': 'same-origin'
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
        }
    },

    // Game settings
    game: {
        maxBetAmount: 1000000,
        minBetAmount: 10,
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