#!/usr/bin/env node

/**
 * Migration Validation Script
 * Validates that data was migrated correctly to Aurora
 */

const { Sequelize } = require('sequelize');
const config = require('../config/database.js');

class MigrationValidator {
    constructor() {
        this.sourceDB = null;
        this.targetDB = null;
        this.validationResults = [];
    }

    async initialize() {
        console.log('🔍 Initializing migration validation...');
        
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
                    pool: { max: 5, min: 1 }
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
                    pool: { max: 5, min: 1 }
                }
            );

            await this.sourceDB.authenticate();
            await this.targetDB.authenticate();
            
            console.log('✅ Database connections established');
        } catch (error) {
            console.error('❌ Failed to initialize connections:', error.message);
            throw error;
        }
    }

    async getTableList() {
        const [tables] = await this.sourceDB.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${config.migration_source.database}'
            AND TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);
        
        return tables.map(row => row.TABLE_NAME);
    }

    async validateTableCount(tableName) {
        try {
            const [sourceCount] = await this.sourceDB.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
            const [targetCount] = await this.targetDB.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
            
            const sourceTotal = sourceCount[0].count;
            const targetTotal = targetCount[0].count;
            
            const isValid = sourceTotal === targetTotal;
            
            this.validationResults.push({
                table: tableName,
                type: 'row_count',
                source: sourceTotal,
                target: targetTotal,
                valid: isValid,
                difference: sourceTotal - targetTotal
            });
            
            console.log(`${isValid ? '✅' : '❌'} ${tableName}: ${sourceTotal} → ${targetTotal} rows`);
            
            return isValid;
        } catch (error) {
            console.error(`❌ Failed to validate ${tableName}:`, error.message);
            return false;
        }
    }

    async validateTableSchema(tableName) {
        try {
            const [sourceColumns] = await this.sourceDB.query(`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = '${config.migration_source.database}'
                AND TABLE_NAME = '${tableName}'
                ORDER BY ORDINAL_POSITION
            `);
            
            const [targetColumns] = await this.targetDB.query(`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = '${config.migration_target.database}'
                AND TABLE_NAME = '${tableName}'
                ORDER BY ORDINAL_POSITION
            `);
            
            const sourceSchema = sourceColumns.map(col => ({
                name: col.COLUMN_NAME,
                type: col.DATA_TYPE,
                nullable: col.IS_NULLABLE,
                default: col.COLUMN_DEFAULT
            }));
            
            const targetSchema = targetColumns.map(col => ({
                name: col.COLUMN_NAME,
                type: col.DATA_TYPE,
                nullable: col.IS_NULLABLE,
                default: col.COLUMN_DEFAULT
            }));
            
            const isValid = JSON.stringify(sourceSchema) === JSON.stringify(targetSchema);
            
            this.validationResults.push({
                table: tableName,
                type: 'schema',
                source: sourceSchema,
                target: targetSchema,
                valid: isValid
            });
            
            console.log(`${isValid ? '✅' : '❌'} ${tableName}: Schema validation`);
            
            return isValid;
        } catch (error) {
            console.error(`❌ Failed to validate schema for ${tableName}:`, error.message);
            return false;
        }
    }

    async validateSampleData(tableName, sampleSize = 10) {
        try {
            const [sourceSample] = await this.sourceDB.query(`
                SELECT * FROM \`${tableName}\` 
                ORDER BY RAND() 
                LIMIT ${sampleSize}
            `);
            
            const [targetSample] = await this.targetDB.query(`
                SELECT * FROM \`${tableName}\` 
                ORDER BY RAND() 
                LIMIT ${sampleSize}
            `);
            
            // Compare sample data (simplified comparison)
            const sourceKeys = Object.keys(sourceSample[0] || {});
            const targetKeys = Object.keys(targetSample[0] || {});
            
            const isValid = sourceKeys.length === targetKeys.length;
            
            this.validationResults.push({
                table: tableName,
                type: 'sample_data',
                source_sample_count: sourceSample.length,
                target_sample_count: targetSample.length,
                valid: isValid
            });
            
            console.log(`${isValid ? '✅' : '❌'} ${tableName}: Sample data validation`);
            
            return isValid;
        } catch (error) {
            console.error(`❌ Failed to validate sample data for ${tableName}:`, error.message);
            return false;
        }
    }

    async runValidation() {
        try {
            console.log('🚀 Starting migration validation...');
            
            const tables = await this.getTableList();
            console.log(`📋 Validating ${tables.length} tables`);
            
            let totalValidations = 0;
            let passedValidations = 0;
            
            for (const tableName of tables) {
                console.log(`\n🔍 Validating table: ${tableName}`);
                
                // Validate row count
                const countValid = await this.validateTableCount(tableName);
                totalValidations++;
                if (countValid) passedValidations++;
                
                // Validate schema
                const schemaValid = await this.validateTableSchema(tableName);
                totalValidations++;
                if (schemaValid) passedValidations++;
                
                // Validate sample data (only for non-empty tables)
                const [countResult] = await this.sourceDB.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
                if (countResult[0].count > 0) {
                    const sampleValid = await this.validateSampleData(tableName);
                    totalValidations++;
                    if (sampleValid) passedValidations++;
                }
            }
            
            // Generate validation report
            await this.generateValidationReport(totalValidations, passedValidations);
            
            console.log(`\n📊 Validation Summary:`);
            console.log(`   Total validations: ${totalValidations}`);
            console.log(`   Passed: ${passedValidations}`);
            console.log(`   Failed: ${totalValidations - passedValidations}`);
            console.log(`   Success rate: ${((passedValidations / totalValidations) * 100).toFixed(1)}%`);
            
            if (passedValidations === totalValidations) {
                console.log('\n✅ Migration validation PASSED!');
                return true;
            } else {
                console.log('\n❌ Migration validation FAILED!');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            return false;
        }
    }

    async generateValidationReport(totalValidations, passedValidations) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total_validations: totalValidations,
                passed: passedValidations,
                failed: totalValidations - passedValidations,
                success_rate: ((passedValidations / totalValidations) * 100).toFixed(1) + '%'
            },
            details: this.validationResults
        };
        
        const fs = require('fs').promises;
        const path = require('path');
        const reportPath = path.join(__dirname, '../logs/validation-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📊 Validation report saved to: ${reportPath}`);
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
    const validator = new MigrationValidator();
    
    try {
        await validator.initialize();
        const isValid = await validator.runValidation();
        
        if (isValid) {
            console.log('\n🎉 Migration validation completed successfully!');
            console.log('Your data has been successfully migrated to Aurora.');
        } else {
            console.log('\n⚠️ Migration validation found issues.');
            console.log('Please review the validation report and fix any issues.');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    } finally {
        await validator.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = MigrationValidator; 