#!/usr/bin/env node

/**
 * Database Migration Script for Aurora
 * Migrates data from current database to new Aurora cluster
 */

const { Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/database.js');

class DatabaseMigration {
    constructor() {
        this.sourceDB = null;
        this.targetDB = null;
        this.migrationLog = [];
    }

    async initialize() {
        console.log('🚀 Initializing database migration...');
        
        try {
            // Initialize source database connection
            this.sourceDB = new Sequelize(
                config.migration_source.database,
                config.migration_source.username,
                config.migration_source.password,
                {
                    host: config.migration_source.host,
                    port: config.migration_source.port,
                    dialect: config.migration_source.dialect,
                    logging: false,
                    pool: config.migration_source.pool
                }
            );

            // Initialize target database connection
            this.targetDB = new Sequelize(
                config.migration_target.database,
                config.migration_target.username,
                config.migration_target.password,
                {
                    host: config.migration_target.host,
                    port: config.migration_target.port,
                    dialect: config.migration_target.dialect,
                    logging: false,
                    pool: config.migration_target.pool
                }
            );

            // Test connections
            await this.sourceDB.authenticate();
            console.log('✅ Source database connected');
            
            await this.targetDB.authenticate();
            console.log('✅ Target Aurora database connected');

        } catch (error) {
            console.error('❌ Failed to initialize database connections:', error.message);
            throw error;
        }
    }

    async getTableList() {
        try {
            const [tables] = await this.sourceDB.query(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = '${config.migration_source.database}'
                AND TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME
            `);
            
            return tables.map(row => row.TABLE_NAME);
        } catch (error) {
            console.error('❌ Failed to get table list:', error.message);
            throw error;
        }
    }

    async getTableSchema(tableName) {
        try {
            const [columns] = await this.sourceDB.query(`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = '${config.migration_source.database}'
                AND TABLE_NAME = '${tableName}'
                ORDER BY ORDINAL_POSITION
            `);
            
            return columns;
        } catch (error) {
            console.error(`❌ Failed to get schema for ${tableName}:`, error.message);
            throw error;
        }
    }

    async createTableInTarget(tableName, schema) {
        try {
            const createTableSQL = this.generateCreateTableSQL(tableName, schema);
            await this.targetDB.query(createTableSQL);
            console.log(`✅ Created table: ${tableName}`);
        } catch (error) {
            console.error(`❌ Failed to create table ${tableName}:`, error.message);
            throw error;
        }
    }

    generateCreateTableSQL(tableName, schema) {
        let sql = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n`;
        
        const columns = schema.map(col => {
            let columnDef = `  \`${col.COLUMN_NAME}\` ${col.DATA_TYPE}`;
            
            if (col.IS_NULLABLE === 'NO') {
                columnDef += ' NOT NULL';
            }
            
            if (col.COLUMN_DEFAULT !== null) {
                columnDef += ` DEFAULT '${col.COLUMN_DEFAULT}'`;
            }
            
            if (col.EXTRA) {
                columnDef += ` ${col.EXTRA}`;
            }
            
            return columnDef;
        });
        
        sql += columns.join(',\n') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;';
        
        return sql;
    }

    async migrateTableData(tableName, batchSize = 1000) {
        try {
            console.log(`🔄 Migrating data for table: ${tableName}`);
            
            // Get total count
            const [countResult] = await this.sourceDB.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
            const totalCount = countResult[0].count;
            
            if (totalCount === 0) {
                console.log(`ℹ️ Table ${tableName} is empty, skipping data migration`);
                return;
            }
            
            let migratedCount = 0;
            let offset = 0;
            
            while (migratedCount < totalCount) {
                // Get batch of data
                const [rows] = await this.sourceDB.query(`
                    SELECT * FROM \`${tableName}\` 
                    LIMIT ${batchSize} OFFSET ${offset}
                `);
                
                if (rows.length === 0) break;
                
                // Insert batch into target
                if (rows.length > 0) {
                    const columns = Object.keys(rows[0]);
                    const values = rows.map(row => 
                        columns.map(col => {
                            const value = row[col];
                            return value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
                        })
                    );
                    
                    const insertSQL = `
                        INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) 
                        VALUES ${values.map(v => `(${v.join(', ')})`).join(', ')}
                        ON DUPLICATE KEY UPDATE ${columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')}
                    `;
                    
                    await this.targetDB.query(insertSQL);
                }
                
                migratedCount += rows.length;
                offset += batchSize;
                
                console.log(`📊 Migrated ${migratedCount}/${totalCount} rows from ${tableName}`);
            }
            
            console.log(`✅ Completed migration for table: ${tableName}`);
            
        } catch (error) {
            console.error(`❌ Failed to migrate data for ${tableName}:`, error.message);
            throw error;
        }
    }

    async migrateIndexes(tableName) {
        try {
            const [indexes] = await this.sourceDB.query(`
                SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
                FROM INFORMATION_SCHEMA.STATISTICS 
                WHERE TABLE_SCHEMA = '${config.migration_source.database}'
                AND TABLE_NAME = '${tableName}'
                AND INDEX_NAME != 'PRIMARY'
                ORDER BY INDEX_NAME, SEQ_IN_INDEX
            `);
            
            for (const index of indexes) {
                if (index.SEQ_IN_INDEX === 1) {
                    const indexColumns = indexes
                        .filter(i => i.INDEX_NAME === index.INDEX_NAME)
                        .map(i => i.COLUMN_NAME);
                    
                    const createIndexSQL = `
                        CREATE ${index.NON_UNIQUE === 0 ? 'UNIQUE' : ''} INDEX \`${index.INDEX_NAME}\` 
                        ON \`${tableName}\` (\`${indexColumns.join('`, `')}\`)
                    `;
                    
                    try {
                        await this.targetDB.query(createIndexSQL);
                        console.log(`✅ Created index: ${index.INDEX_NAME} on ${tableName}`);
                    } catch (error) {
                        console.warn(`⚠️ Failed to create index ${index.INDEX_NAME}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Failed to migrate indexes for ${tableName}:`, error.message);
        }
    }

    async runMigration() {
        try {
            console.log('🚀 Starting database migration...');
            
            // Get list of tables
            const tables = await this.getTableList();
            console.log(`📋 Found ${tables.length} tables to migrate`);
            
            // Migrate each table
            for (const tableName of tables) {
                console.log(`\n🔄 Processing table: ${tableName}`);
                
                try {
                    // Get table schema
                    const schema = await this.getTableSchema(tableName);
                    
                    // Create table in target
                    await this.createTableInTarget(tableName, schema);
                    
                    // Migrate data
                    await this.migrateTableData(tableName);
                    
                    // Migrate indexes
                    await this.migrateIndexes(tableName);
                    
                    this.migrationLog.push({
                        table: tableName,
                        status: 'success',
                        timestamp: new Date().toISOString()
                    });
                    
                } catch (error) {
                    console.error(`❌ Failed to migrate table ${tableName}:`, error.message);
                    this.migrationLog.push({
                        table: tableName,
                        status: 'failed',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Generate migration report
            await this.generateMigrationReport();
            
            console.log('\n✅ Migration completed!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
    }

    async generateMigrationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            source: config.migration_source.host,
            target: config.migration_target.host,
            summary: {
                total: this.migrationLog.length,
                successful: this.migrationLog.filter(log => log.status === 'success').length,
                failed: this.migrationLog.filter(log => log.status === 'failed').length
            },
            details: this.migrationLog
        };
        
        const reportPath = path.join(__dirname, '../logs/migration-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📊 Migration report saved to: ${reportPath}`);
    }

    async cleanup() {
        if (this.sourceDB) {
            await this.sourceDB.close();
        }
        if (this.targetDB) {
            await this.targetDB.close();
        }
        console.log('🧹 Database connections closed');
    }
}

// Main execution
async function main() {
    const migration = new DatabaseMigration();
    
    try {
        await migration.initialize();
        await migration.runMigration();
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await migration.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = DatabaseMigration; 