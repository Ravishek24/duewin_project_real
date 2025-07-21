let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




/**
 * Test Redis Helper - Prevents connection leaks in test scripts
 * Use this instead of creating new Redis connections in tests
 */
class TestRedisHelper {
    constructor() {
        this.testConnections = new Map();
        this.testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get a Redis connection for testing (automatically cleaned up)
     * @param {string} purpose - Purpose of the connection
     * @param {Object} options - Connection options
     * @returns {Redis} Redis connection
     */
    getConnection(purpose = 'test', options = {}) {
        const connectionKey = `${this.testId}_${purpose}`;
        
        if (!this.testConnections.has(connectionKey)) {
            const connection = redisManager.getConnection(connectionKey, options);
            this.testConnections.set(connectionKey, connection);
            
            console.log(`🧪 Test connection created: ${connectionKey}`);
        }
        
        return this.testConnections.get(connectionKey);
    }

    /**
     * Get main Redis connection for testing
     * @returns {Redis} Main Redis connection
     */
    getMainConnection() {
        return this.getConnection('main');
    }

    /**
     * Get publisher connection for testing
     * @returns {Redis} Publisher Redis connection
     */
    getPublisherConnection() {
        return this.getConnection('publisher');
    }

    /**
     * Get subscriber connection for testing
     * @returns {Redis} Subscriber Redis connection
     */
    getSubscriberConnection() {
        return this.getConnection('subscriber');
    }

    /**
     * Clean up all test connections
     * Call this at the end of your test
     */
    async cleanup() {
        console.log(`🧹 Cleaning up test connections: ${this.testId}`);
        
        for (const [key, connection] of this.testConnections) {
            try {
                // Don't actually quit the connection since it's shared
                // Just remove from our test tracking
                console.log(`✅ Test connection tracked: ${key}`);
            } catch (error) {
                console.error(`❌ Error tracking test connection ${key}:`, error.message);
            }
        }
        
        this.testConnections.clear();
        console.log(`✅ Test cleanup completed: ${this.testId}`);
    }

    /**
     * Run a test with automatic cleanup
     * @param {Function} testFunction - The test function to run
     */
    async runTest(testFunction) {
        try {
            console.log(`🧪 Starting test: ${this.testId}`);
            await testFunction(this);
            console.log(`✅ Test completed: ${this.testId}`);
        } catch (error) {
            console.error(`❌ Test failed: ${this.testId}`, error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Get test statistics
     */
    getTestStats() {
        return {
            testId: this.testId,
            connectionCount: this.testConnections.size,
            connections: Array.from(this.testConnections.keys()),
            managerStats: redisManager.getStats()
        };
    }
}

/**
 * Create a test helper instance
 * @returns {TestRedisHelper} Test helper instance
 */
function createTestHelper() {
    return new TestRedisHelper();
}

/**
 * Run a test with automatic cleanup
 * @param {Function} testFunction - The test function to run
 */
async function runTest(testFunction) {
    const helper = new TestRedisHelper();
    await helper.runTest(testFunction);
}

module.exports = {
    TestRedisHelper,
    createTestHelper,
    runTest,
    redisManager
}; 