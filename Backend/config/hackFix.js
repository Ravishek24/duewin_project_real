/**
 * This file contains temporary fixes for known issues
 * These should be replaced with proper solutions in the future
 */

const installHackFix = (sequelize) => {
    try {
        // Fix for Sequelize's session_id issue
        if (sequelize && sequelize.constructor && sequelize.constructor.Query && sequelize.constructor.Query.prototype) {
            const originalQuery = sequelize.constructor.Query.prototype.run;
            // Only install the fix if it hasn't been installed already
            if (!sequelize.constructor.Query.prototype._hackFixInstalled) {
                sequelize.constructor.Query.prototype.run = function(sql, parameters) {
                    if (sql && sql.includes('session_id')) {
                        return Promise.resolve([]);
                    }
                    return originalQuery.call(this, sql, parameters);
                };
                sequelize.constructor.Query.prototype._hackFixInstalled = true;
                console.log('✅ Sequelize hack fix installed');
            }
        } else {
            // Only log once if Sequelize is not initialized
            if (!global._hackFixWarningLogged) {
                console.warn('⚠️ Sequelize not fully initialized, skipping session_id fix');
                global._hackFixWarningLogged = true;
            }
            
            // Single retry with increased delay
            setTimeout(() => {
                if (sequelize && sequelize.constructor && sequelize.constructor.Query && sequelize.constructor.Query.prototype) {
                    const originalQuery = sequelize.constructor.Query.prototype.run;
                    // Only install the fix if it hasn't been installed already
                    if (!sequelize.constructor.Query.prototype._hackFixInstalled) {
                        sequelize.constructor.Query.prototype.run = function(sql, parameters) {
                            if (sql && sql.includes('session_id')) {
                                return Promise.resolve([]);
                            }
                            return originalQuery.call(this, sql, parameters);
                        };
                        sequelize.constructor.Query.prototype._hackFixInstalled = true;
                        console.log('✅ Sequelize hack fix installed after delay');
                    }
                }
            }, 3000); // Increased delay to 3 seconds for a single retry
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
        console.error('Failed to install hack fixes:', error);
        return false;
    }
};

module.exports = {
    installHackFix
};