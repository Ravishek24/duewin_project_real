// Ultra-lightweight performance tracking middleware
const performanceTracker = (req, res, next) => {
    // Only track performance for login endpoints to minimize overhead
    if (req.path && (req.path.includes('/auth/') || req.path.includes('/login'))) {
        const start = process.hrtime.bigint();
        
        // Minimal override - only for auth endpoints
        const originalJson = res.json;
        res.json = function(data) {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000;
            
            console.log(`⚡ LOGIN [${req.method} ${req.path}]: ${duration.toFixed(2)}ms`);
            res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
            
            if (duration > 300) {
                console.warn(`🐌 SLOW LOGIN: ${duration.toFixed(2)}ms (target: <200ms)`);
            }
            
            return originalJson.call(this, data);
        };
    }
    
    next();
};

// Helper function to add timing points
const addTiming = (req, category, operation, duration) => {
    if (req.timings && req.timings[category]) {
        req.timings[category][operation] = duration;
    }
};

module.exports = {
    performanceTracker,
    addTiming
};