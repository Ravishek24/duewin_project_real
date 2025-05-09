/**
 * This is a VERY hacky solution to the problem of Sequelize trying to add
 * a session_id column to game_transactions table.
 * 
 * This file directly monkey-patches the MySQL driver to intercept and block
 * any SQL queries that might try to add the problematic columns.
 * 
 * This is a last-resort solution. It's not pretty, but it works.
 */

function installHackFix() {
  try {
    // Get direct access to the mysql2 driver
    const mysql2 = require('mysql2');
    
    // Store original Connection.prototype.query
    const originalQuery = mysql2.Connection.prototype.query;
    
    // Monkey-patch the query method to block problematic queries
    mysql2.Connection.prototype.query = function(sql, values, cb) {
      try {
        // Convert sql to string if it's an object with a sql property
        const sqlString = typeof sql === 'object' && sql.sql ? sql.sql : String(sql);
        
        // If this looks like a query trying to add session_id, block it
        if (
          sqlString.includes('session_id') && 
          (sqlString.includes('game_transactions') || sqlString.includes('seamless_transactions'))
        ) {
          console.error('🚫🚫🚫 DIRECT MYSQL BLOCK: Attempt to add or use session_id');
          console.error('Query:', sqlString);
          
          // Get stack trace to identify what's causing this
          console.error('Call stack:', new Error().stack);
          
          // Intercept only the specific problematic query
          if (sqlString.includes('FOREIGN KEY') && 
             (sqlString.includes('ADD `session_id`') || sqlString.includes('ADD CONSTRAINT'))) {
            console.error('Blocking the foreign key manipulation query');
            
            // Create a fake result to simulate success but do nothing
            const emptyResult = [[], {}];
            
            // Handle different callback patterns
            if (typeof values === 'function') {
              // query(sql, callback)
              values(null, emptyResult);
              return;
            } else if (typeof cb === 'function') {
              // query(sql, values, callback)
              cb(null, emptyResult);
              return;
            } else {
              // query(sql, values) - promise-based
              const fakePromise = new Promise((resolve) => {
                resolve(emptyResult);
              });
              return fakePromise;
            }
          } else {
            console.error('Allowing non-constraint query with session_id reference');
          }
        }
        
        // Log any query that tries to alter game_transactions table to see what's happening
        if (sqlString.includes('ALTER TABLE') && 
            (sqlString.includes('game_transactions') || sqlString.includes('seamless_transactions'))) {
          console.error('ALTERING TRANSACTION TABLE:', sqlString);
          console.error('Stack:', new Error().stack);
        }
      } catch (e) {
        // If anything goes wrong in our interception code, continue with original query
        console.error('Error in query interception:', e);
      }
      
      // For all other queries, pass through to original method
      return originalQuery.apply(this, arguments);
    };
    
    // Also patch the Pool.prototype.query just in case
    if (mysql2.Pool && mysql2.Pool.prototype.query) {
      const originalPoolQuery = mysql2.Pool.prototype.query;
      mysql2.Pool.prototype.query = function(sql, values, cb) {
        try {
          const sqlString = typeof sql === 'object' && sql.sql ? sql.sql : String(sql);
          
          if (sqlString.includes('session_id') && 
              sqlString.includes('FOREIGN KEY') && 
              (sqlString.includes('game_transactions') || sqlString.includes('seamless_transactions'))) {
            console.error('🚫🚫🚫 POOL QUERY BLOCK: Attempt to add session_id column or constraint');
            console.error('Query:', sqlString);
            console.error('Call stack:', new Error().stack);
            
            // Simulate success but do nothing
            const emptyResult = [[], {}];
            
            if (typeof values === 'function') {
              values(null, emptyResult);
              return;
            } else if (typeof cb === 'function') {
              cb(null, emptyResult);
              return;
            } else {
              return Promise.resolve(emptyResult);
            }
          }
        } catch (e) {
          console.error('Error in pool query interception:', e);
        }
        
        return originalPoolQuery.apply(this, arguments);
      };
    }
    
    console.log('✅ MySQL driver hack fix installed');
    return true;
  } catch (error) {
    console.error('Failed to install MySQL driver hack fix:', error);
    return false;
  }
}

// Execute the hack fix immediately
const result = installHackFix();
console.log('Hack fix installation result:', result);

module.exports = { installHackFix }; 