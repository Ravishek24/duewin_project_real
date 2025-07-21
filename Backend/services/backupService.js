const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const execAsync = promisify(exec);
const cron = require('node-cron');
const securityConfig = require('../config/securityConfig');
const logger = require('../utils/logger');
const encryptionService = require('./encryptionService');
const monitoringService = require('./monitoringService');

class BackupService {
    constructor() {
        this.backupDir = path.join(process.cwd(), 'backups');
        this.retentionPeriod = this.parseRetentionPeriod(securityConfig.backup.retention);
        this.schedule = securityConfig.backup.schedule;
        this.dbConfig = require('../config/db');
        this.isBackupInProgress = false;
    }

    parseRetentionPeriod(period) {
        const match = period.match(/^(\d+)([dmy])$/);
        if (!match) return 30; // Default to 30 days

        const [, value, unit] = match;
        const days = parseInt(value);
        
        switch (unit) {
            case 'd': return days;
            case 'm': return days * 30;
            case 'y': return days * 365;
            default: return 30;
        }
    }

    async initialize() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            logger.info('Backup directory initialized');
            
            // Schedule automated backups
            if (this.schedule) {
                cron.schedule(this.schedule, async () => {
                    await this.createBackup();
                });
                logger.info(`Backup scheduling initialized with cron: ${this.schedule}`);
            }
        } catch (error) {
            logger.error('Failed to initialize backup service:', error);
            throw error;
        }
    }

    async createBackup() {
        if (this.isBackupInProgress) {
            logger.warn('Backup already in progress, skipping');
            return;
        }

        this.isBackupInProgress = true;
        const startTime = Date.now();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `backup-${timestamp}.sql`;
        const backupPath = path.join(this.backupDir, backupFileName);
        const encryptedPath = `${backupPath}.enc`;

        try {
            // Create database dump
            const dumpCommand = `mysqldump -h ${this.dbConfig.host} -u ${this.dbConfig.username} -p${this.dbConfig.password} ${this.dbConfig.database} > ${backupPath}`;
            await execAsync(dumpCommand);
            logger.info('Database dump created successfully');

            // Compress backup if enabled
            if (securityConfig.backup.compression) {
                const compressedPath = `${backupPath}.gz`;
                await execAsync(`gzip ${backupPath}`);
                await fs.rename(`${backupPath}.gz`, compressedPath);
                backupPath = compressedPath;
            }

            // Encrypt the backup file
            const backupData = await fs.readFile(backupPath);
            const encryptedData = await encryptionService.encrypt(backupData);
            await fs.writeFile(encryptedPath, JSON.stringify(encryptedData));

            // Remove original unencrypted file
            await fs.unlink(backupPath);

            // Clean up old backups
            await this.cleanupOldBackups();

            // Track backup metrics
            const duration = Date.now() - startTime;
            await monitoringService.trackBackupMetrics({
                size: (await fs.stat(encryptedPath)).size,
                duration,
                success: true
            });

            logger.info('Backup completed successfully', {
                duration,
                size: (await fs.stat(encryptedPath)).size
            });

            return encryptedPath;
        } catch (error) {
            logger.error('Backup creation failed:', error);
            
            // Track failed backup
            await monitoringService.trackBackupMetrics({
                duration: Date.now() - startTime,
                success: false,
                error: error.message
            });

            throw error;
        } finally {
            this.isBackupInProgress = false;
        }
    }

    async restoreBackup(backupPath) {
        const startTime = Date.now();
        try {
            // Read encrypted backup
            const encryptedData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
            
            // Decrypt backup
            const decryptedData = await encryptionService.decrypt(encryptedData);
            
            // Create temporary file for decrypted data
            const tempPath = `${backupPath}.temp`;
            await fs.writeFile(tempPath, decryptedData);
            
            // Restore database
            const restoreCommand = `mysql -h ${this.dbConfig.host} -u ${this.dbConfig.username} -p${this.dbConfig.password} ${this.dbConfig.database} < ${tempPath}`;
            await execAsync(restoreCommand);
            
            // Clean up temporary file
            await fs.unlink(tempPath);
            
            // Track restore metrics
            const duration = Date.now() - startTime;
            await monitoringService.trackRestoreMetrics({
                duration,
                success: true
            });

            logger.info('Database restored successfully', { duration });
        } catch (error) {
            logger.error('Backup restoration failed:', error);
            
            // Track failed restore
            await monitoringService.trackRestoreMetrics({
                duration: Date.now() - startTime,
                success: false,
                error: error.message
            });

            throw error;
        }
    }

    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const now = new Date();
            
            for (const file of files) {
                const filePath = path.join(this.backupDir, file);
                const stats = await fs.stat(filePath);
                const fileAge = (now - stats.mtime) / (1000 * 60 * 60 * 24); // Age in days
                
                if (fileAge > this.retentionPeriod) {
                    await fs.unlink(filePath);
                    logger.info(`Deleted old backup: ${file}`);
                }
            }
        } catch (error) {
            logger.error('Failed to cleanup old backups:', error);
            throw error;
        }
    }

    async listBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = [];
            
            for (const file of files) {
                const filePath = path.join(this.backupDir, file);
                const stats = await fs.stat(filePath);
                
                backups.push({
                    name: file,
                    size: stats.size,
                    created: stats.mtime,
                    path: filePath
                });
            }
            
            return backups.sort((a, b) => b.created - a.created);
        } catch (error) {
            logger.error('Failed to list backups:', error);
            throw error;
        }
    }

    async verifyBackup(backupPath) {
        const startTime = Date.now();
        try {
            // Read encrypted backup
            const encryptedData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
            
            // Decrypt backup
            const decryptedData = await encryptionService.decrypt(encryptedData);
            
            // Create temporary file
            const tempPath = `${backupPath}.temp`;
            await fs.writeFile(tempPath, decryptedData);
            
            // Verify SQL syntax
            const verifyCommand = `mysqlcheck -h ${this.dbConfig.host} -u ${this.dbConfig.username} -p${this.dbConfig.password} --check ${this.dbConfig.database} < ${tempPath}`;
            await execAsync(verifyCommand);
            
            // Clean up temporary file
            await fs.unlink(tempPath);
            
            // Track verification metrics
            const duration = Date.now() - startTime;
            await monitoringService.trackBackupVerification({
                duration,
                success: true
            });

            logger.info('Backup verification successful', { duration });
            return true;
        } catch (error) {
            logger.error('Backup verification failed:', error);
            
            // Track failed verification
            await monitoringService.trackBackupVerification({
                duration: Date.now() - startTime,
                success: false,
                error: error.message
            });

            return false;
        }
    }
}

module.exports = new BackupService(); 
