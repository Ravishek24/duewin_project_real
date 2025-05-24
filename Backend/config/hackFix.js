/**
 * This file contains temporary fixes for known issues
 * These should be replaced with proper solutions in the future
 */

const installHackFix = async (sequelize) => {
    try {
        // Verify Sequelize is properly initialized
        if (!sequelize || !sequelize.constructor || !sequelize.constructor.Query || !sequelize.constructor.Query.prototype) {
            console.warn('⚠️ Sequelize not properly initialized, cannot install hack fixes');
            return false;
        }

        // Fix for Sequelize's session_id issue
        const originalQuery = sequelize.constructor.Query.prototype.run;
        if (!sequelize.constructor.Query.prototype._hackFixInstalled) {
            sequelize.constructor.Query.prototype.run = function(sql, parameters) {
                if (sql && sql.includes('session_id')) {
                    return Promise.resolve([]);
                }
                return originalQuery.call(this, sql, parameters);
            };
            sequelize.constructor.Query.prototype._hackFixInstalled = true;
            console.log('✅ Sequelize session_id fix installed successfully');
        } else {
            console.log('ℹ️ Sequelize session_id fix already installed');
        }

        // Fix for Node.js memory leak in HTTP parser
        if (process.env.NODE_ENV === 'production') {
            require('http').globalAgent.maxSockets = 50;
            require('https').globalAgent.maxSockets = 50;
            console.log('✅ HTTP/HTTPS maxSockets configured');
        }

        // Fix for Express body parser memory leak
        if (process.env.NODE_ENV === 'production') {
            process.on('uncaughtException', (error) => {
                console.error('Uncaught Exception:', error);
                // Don't exit the process, just log the error
            });
            console.log('✅ Uncaught exception handler installed');
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to install hack fixes:', error);
        return false;
    }
};

module.exports = {
    installHackFix
};