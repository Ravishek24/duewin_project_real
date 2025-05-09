const debug = require('debug')('app:sequelize-observer');

// Create Sequelize Observer
class SequelizeObserver {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.originalQuery = sequelize.query;
    this.setupQueryInterceptor();
  }

  setupQueryInterceptor() {
    // Override the query method to intercept and potentially block problematic queries
    this.sequelize.query = (...args) => {
      const sql = args[0];
      
      // Convert to string if it's an object
      const sqlString = typeof sql === 'object' ? sql.query : sql;
      
      // Check if this is a problematic query that's trying to add session_id
      if (
        typeof sqlString === 'string' && (
          (sqlString.includes('session_id') && 
           sqlString.includes('FOREIGN KEY') && 
           sqlString.includes('game_transactions')) ||
          (sqlString.includes('session_id') && 
           sqlString.includes('FOREIGN KEY') && 
           sqlString.includes('seamless_transactions'))
        )
      ) {
        console.error('🚫 BLOCKED QUERY: Attempt to add session_id column or constraint');
        console.error('Query:', sqlString);
        
        // Return a promise that resolves to indicate "query executed successfully"
        // but actually do nothing
        return Promise.resolve([[], []]);
      }
      
      // For all other queries, pass through to the original method
      return this.originalQuery.apply(this.sequelize, args);
    };
    
    console.log('✅ Sequelize query interceptor installed');
  }
}

module.exports = { SequelizeObserver }; 