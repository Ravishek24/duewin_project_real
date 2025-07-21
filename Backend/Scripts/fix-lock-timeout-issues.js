/**
 * Script to monitor and fix lock timeout issues
 * Run this script to identify and resolve database lock issues
 */

const { sequelize } = require('../config/database');
const { executeWithRetry, isLockTimeoutError } = require('../utils/databaseUtils');

/**
 * Check for active locks in the database
 */
const checkActiveLocks = async () => {
  try {
    console.log('🔍 Checking for active locks...');
    
    const locks = await sequelize.query(`
      SELECT 
        trx_id,
        trx_mysql_thread_id,
        trx_query,
        trx_operation_state,
        trx_tables_in_use,
        trx_tables_locked,
        trx_lock_structs,
        trx_rows_locked,
        trx_rows_modified,
        trx_concurrency_tickets,
        trx_isolation_level,
        trx_unique_checks,
        trx_foreign_key_checks,
        trx_last_foreign_key_error,
        trx_adaptive_hash_latched,
        trx_adaptive_hash_timeout,
        trx_is_read_only,
        trx_autocommit_non_locking
      FROM information_schema.INNODB_TRX
      WHERE trx_state = 'LOCK WAIT'
      ORDER BY trx_started ASC
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    if (locks.length === 0) {
      console.log('✅ No active lock waits found');
      return [];
    }
    
    console.log(`⚠️  Found ${locks.length} active lock waits:`);
    locks.forEach((lock, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${lock.trx_id}`);
      console.log(`   MySQL Thread ID: ${lock.trx_mysql_thread_id}`);
      console.log(`   Query: ${lock.trx_query || 'N/A'}`);
      console.log(`   Operation State: ${lock.trx_operation_state}`);
      console.log(`   Rows Locked: ${lock.trx_rows_locked}`);
      console.log(`   Rows Modified: ${lock.trx_rows_modified}`);
    });
    
    return locks;
  } catch (error) {
    console.error('❌ Error checking active locks:', error);
    return [];
  }
};

/**
 * Check for long-running transactions
 */
const checkLongRunningTransactions = async () => {
  try {
    console.log('\n🔍 Checking for long-running transactions...');
    
    const longTransactions = await sequelize.query(`
      SELECT 
        trx_id,
        trx_mysql_thread_id,
        trx_query,
        trx_started,
        TIMESTAMPDIFF(SECOND, trx_started, NOW()) as duration_seconds,
        trx_rows_locked,
        trx_rows_modified
      FROM information_schema.INNODB_TRX
      WHERE trx_state = 'RUNNING'
      AND TIMESTAMPDIFF(SECOND, trx_started, NOW()) > 30
      ORDER BY trx_started ASC
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    if (longTransactions.length === 0) {
      console.log('✅ No long-running transactions found');
      return [];
    }
    
    console.log(`⚠️  Found ${longTransactions.length} long-running transactions:`);
    longTransactions.forEach((txn, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${txn.trx_id}`);
      console.log(`   MySQL Thread ID: ${txn.trx_mysql_thread_id}`);
      console.log(`   Duration: ${txn.duration_seconds} seconds`);
      console.log(`   Query: ${txn.trx_query || 'N/A'}`);
      console.log(`   Rows Locked: ${txn.trx_rows_locked}`);
      console.log(`   Rows Modified: ${txn.trx_rows_modified}`);
    });
    
    return longTransactions;
  } catch (error) {
    console.error('❌ Error checking long-running transactions:', error);
    return [];
  }
};

/**
 * Kill a specific transaction
 */
const killTransaction = async (mysqlThreadId) => {
  try {
    console.log(`🔄 Killing transaction with MySQL Thread ID: ${mysqlThreadId}`);
    
    await sequelize.query(`KILL ${mysqlThreadId}`, {
      type: sequelize.QueryTypes.RAW
    });
    
    console.log(`✅ Successfully killed transaction ${mysqlThreadId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error killing transaction ${mysqlThreadId}:`, error);
    return false;
  }
};

/**
 * Check for stuck withdrawal records
 */
const checkStuckWithdrawals = async () => {
  try {
    console.log('\n🔍 Checking for stuck withdrawal records...');
    
    const stuckWithdrawals = await sequelize.query(`
      SELECT 
        id,
        user_id,
        order_id,
        transaction_id,
        amount,
        status,
        admin_status,
        created_at,
        updated_at,
        TIMESTAMPDIFF(MINUTE, created_at, NOW()) as age_minutes
      FROM wallet_withdrawals
      WHERE status IN ('pending', 'approved', 'processing')
      AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) > 60
      ORDER BY created_at ASC
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    if (stuckWithdrawals.length === 0) {
      console.log('✅ No stuck withdrawal records found');
      return [];
    }
    
    console.log(`⚠️  Found ${stuckWithdrawals.length} stuck withdrawal records:`);
    stuckWithdrawals.forEach((withdrawal, index) => {
      console.log(`\n${index + 1}. Withdrawal ID: ${withdrawal.id}`);
      console.log(`   Order ID: ${withdrawal.order_id}`);
      console.log(`   User ID: ${withdrawal.user_id}`);
      console.log(`   Amount: ${withdrawal.amount}`);
      console.log(`   Status: ${withdrawal.status}`);
      console.log(`   Admin Status: ${withdrawal.admin_status}`);
      console.log(`   Age: ${withdrawal.age_minutes} minutes`);
    });
    
    return stuckWithdrawals;
  } catch (error) {
    console.error('❌ Error checking stuck withdrawals:', error);
    return [];
  }
};

/**
 * Reset stuck withdrawal status
 */
const resetStuckWithdrawal = async (withdrawalId) => {
  try {
    console.log(`🔄 Resetting stuck withdrawal ID: ${withdrawalId}`);
    
    const result = await executeWithRetry(async (transaction) => {
      const withdrawal = await sequelize.models.WalletWithdrawal.findByPk(withdrawalId, {
        lock: true,
        transaction
      });
      
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      
      // Reset to pending status
      await withdrawal.update({
        status: 'pending',
        admin_status: 'pending',
        updated_at: new Date()
      }, { transaction });
      
      return withdrawal;
    }, {
      maxRetries: 5,
      baseDelay: 200,
      maxDelay: 2000
    });
    
    console.log(`✅ Successfully reset withdrawal ${withdrawalId}`);
    return result;
  } catch (error) {
    console.error(`❌ Error resetting withdrawal ${withdrawalId}:`, error);
    return null;
  }
};

/**
 * Monitor database performance
 */
const monitorDatabasePerformance = async () => {
  try {
    console.log('\n📊 Database Performance Metrics:');
    
    // Check connection count
    const connections = await sequelize.query(`
      SHOW STATUS LIKE 'Threads_connected'
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`Active Connections: ${connections[0]?.Value || 'N/A'}`);
    
    // Check lock wait time
    const lockWaitTime = await sequelize.query(`
      SHOW VARIABLES LIKE 'innodb_lock_wait_timeout'
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`Lock Wait Timeout: ${lockWaitTime[0]?.Value || 'N/A'} seconds`);
    
    // Check transaction isolation level
    const isolationLevel = await sequelize.query(`
      SELECT @@transaction_isolation as isolation_level
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`Transaction Isolation Level: ${isolationLevel[0]?.isolation_level || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Error monitoring database performance:', error);
  }
};

/**
 * Main function to run all checks
 */
const main = async () => {
  console.log('🚀 Starting lock timeout issue diagnosis...\n');
  
  try {
    // Check database performance
    await monitorDatabasePerformance();
    
    // Check for active locks
    const activeLocks = await checkActiveLocks();
    
    // Check for long-running transactions
    const longTransactions = await checkLongRunningTransactions();
    
    // Check for stuck withdrawals
    const stuckWithdrawals = await checkStuckWithdrawals();
    
    // Summary
    console.log('\n📋 Summary:');
    console.log(`Active Locks: ${activeLocks.length}`);
    console.log(`Long-running Transactions: ${longTransactions.length}`);
    console.log(`Stuck Withdrawals: ${stuckWithdrawals.length}`);
    
    // Ask user if they want to take action
    if (process.argv.includes('--auto-fix')) {
      console.log('\n🔧 Auto-fix mode enabled...');
      
      // Kill long-running transactions
      for (const txn of longTransactions) {
        await killTransaction(txn.trx_mysql_thread_id);
      }
      
      // Reset stuck withdrawals
      for (const withdrawal of stuckWithdrawals) {
        await resetStuckWithdrawal(withdrawal.id);
      }
      
      console.log('\n✅ Auto-fix completed');
    } else if (activeLocks.length > 0 || longTransactions.length > 0 || stuckWithdrawals.length > 0) {
      console.log('\n💡 To automatically fix issues, run: node fix-lock-timeout-issues.js --auto-fix');
    }
    
  } catch (error) {
    console.error('❌ Error in main function:', error);
  } finally {
    await sequelize.close();
    console.log('\n🏁 Diagnosis completed');
  }
};

// Run the script if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkActiveLocks,
  checkLongRunningTransactions,
  checkStuckWithdrawals,
  killTransaction,
  resetStuckWithdrawal,
  monitorDatabasePerformance
}; 