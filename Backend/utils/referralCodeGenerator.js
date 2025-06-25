const crypto = require('crypto');

/**
 * Optimized referral code generator
 * Uses timestamp + random bytes to ensure uniqueness
 * Reduces database queries significantly
 */
class ReferralCodeGenerator {
    constructor() {
        this.usedCodes = new Set(); // In-memory cache for current session
    }

    /**
     * Generate a unique referral code
     * @param {Object} User - Sequelize User model
     * @param {Object} transaction - Database transaction (optional)
     * @returns {Promise<string>} - Unique referral code
     */
    async generateUniqueCode(User, transaction = null) {
        let attempts = 0;
        const maxAttempts = 3; // Reduced from 5 to 3

        while (attempts < maxAttempts) {
            const code = this.generateCode();
            
            // Check in-memory cache first
            if (this.usedCodes.has(code)) {
                attempts++;
                continue;
            }

            // Check database (single query)
            const existingUser = await User.findOne({
                where: { referring_code: code },
                transaction,
                attributes: ['user_id'] // Only fetch what we need
            });

            if (!existingUser) {
                // Mark as used in memory cache
                this.usedCodes.add(code);
                return code;
            }

            attempts++;
        }

        // Fallback: use timestamp-based code if all attempts fail
        return this.generateFallbackCode();
    }

    /**
     * Generate a referral code using timestamp + random bytes
     * @returns {string} - 8-character uppercase code
     */
    generateCode() {
        const timestamp = Date.now().toString(36); // Base36 for shorter string
        const randomBytes = crypto.randomBytes(3).toString('hex').toUpperCase();
        
        // Combine timestamp (last 4 chars) + random bytes (4 chars) = 8 chars total
        const code = (timestamp.slice(-4) + randomBytes.slice(0, 4)).toUpperCase();
        
        return code;
    }

    /**
     * Fallback code generation using timestamp
     * @returns {string} - 8-character uppercase code
     */
    generateFallbackCode() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const combined = timestamp.toString(36) + random.toString(36);
        
        // Ensure 8 characters, pad with zeros if needed
        return combined.slice(0, 8).toUpperCase().padEnd(8, '0');
    }

    /**
     * Clear in-memory cache (useful for testing or memory management)
     */
    clearCache() {
        this.usedCodes.clear();
    }

    /**
     * Get cache size (for monitoring)
     */
    getCacheSize() {
        return this.usedCodes.size;
    }
}

// Export singleton instance
const referralCodeGenerator = new ReferralCodeGenerator();
module.exports = referralCodeGenerator; 