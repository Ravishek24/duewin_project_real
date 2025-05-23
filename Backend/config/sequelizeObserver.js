// Try to use debug module, but don't fail if it's not available
let debug;
try {
    debug = require('debug')('app:sequelize-observer');
} catch (error) {
    debug = (...args) => console.log('[SequelizeObserver]', ...args);
}

/**
 * This class observes and intercepts Sequelize queries to prevent problematic operations
 */
class SequelizeObserver {
  constructor(sequelize) {
    if (!sequelize) {
      debug('⚠️ Sequelize instance not provided to SequelizeObserver');
      return;
    }
    this.sequelize = sequelize;
    this.installQueryInterceptor();
  }

  installQueryInterceptor() {
    if (!this.sequelize || !this.sequelize.query) {
      debug('⚠️ Cannot install query interceptor: Sequelize not properly initialized');
      return;
    }

    // Store original query method
    const originalQuery = this.sequelize.query;

    // Override query method
    this.sequelize.query = async function(sql, options) {
      try {
        // Convert sql to string if it's an object
        const sqlString = typeof sql === 'object' && sql.sql ? sql.sql : String(sql);
        
        // Block problematic session_id queries
        if (sqlString.includes('session_id') && 
            (sqlString.includes('ALTER TABLE') || sqlString.includes('ADD COLUMN'))) {
          debug('⚠️ Blocked problematic session_id query:', sqlString);
          return Promise.resolve([]);
        }

        // Execute original query for all other cases
        return originalQuery.call(this, sql, options);
      } catch (error) {
        debug('Error in query interceptor:', error);
        throw error;
      }
    };

    debug('✅ Sequelize query interceptor installed');
  }
}

module.exports = { SequelizeObserver }; 