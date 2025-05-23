const crypto = require('crypto');
const securityConfig = require('../config/securityConfig');
const logger = require('../utils/logger');

class EncryptionService {
    constructor() {
        this.algorithm = securityConfig.encryption.algorithm;
        this.key = Buffer.from(securityConfig.encryption.key, 'hex');
        this.ivLength = securityConfig.encryption.ivLength;
        this.saltLength = securityConfig.encryption.saltLength;
        this.iterations = securityConfig.encryption.iterations;
    }

    async encrypt(data) {
        try {
            // Generate random IV
            const iv = crypto.randomBytes(this.ivLength);
            
            // Generate random salt
            const salt = crypto.randomBytes(this.saltLength);
            
            // Derive key using PBKDF2
            const derivedKey = crypto.pbkdf2Sync(
                this.key,
                salt,
                this.iterations,
                32,
                'sha256'
            );
            
            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);
            
            // Encrypt data
            const encrypted = Buffer.concat([
                cipher.update(JSON.stringify(data), 'utf8'),
                cipher.final()
            ]);
            
            // Get auth tag
            const authTag = cipher.getAuthTag();
            
            // Combine all components
            const result = {
                iv: iv.toString('hex'),
                salt: salt.toString('hex'),
                encrypted: encrypted.toString('hex'),
                authTag: authTag.toString('hex')
            };
            
            return result;
        } catch (error) {
            logger.error('Encryption error:', error);
            throw new Error('Encryption failed');
        }
    }

    async decrypt(encryptedData) {
        try {
            // Extract components
            const { iv, salt, encrypted, authTag } = encryptedData;
            
            // Convert hex strings back to buffers
            const ivBuffer = Buffer.from(iv, 'hex');
            const saltBuffer = Buffer.from(salt, 'hex');
            const encryptedBuffer = Buffer.from(encrypted, 'hex');
            const authTagBuffer = Buffer.from(authTag, 'hex');
            
            // Derive key using PBKDF2
            const derivedKey = crypto.pbkdf2Sync(
                this.key,
                saltBuffer,
                this.iterations,
                32,
                'sha256'
            );
            
            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, ivBuffer);
            decipher.setAuthTag(authTagBuffer);
            
            // Decrypt data
            const decrypted = Buffer.concat([
                decipher.update(encryptedBuffer),
                decipher.final()
            ]);
            
            // Parse and return decrypted data
            return JSON.parse(decrypted.toString('utf8'));
        } catch (error) {
            logger.error('Decryption error:', error);
            throw new Error('Decryption failed');
        }
    }

    async hashPassword(password) {
        try {
            // Generate random salt
            const salt = crypto.randomBytes(16);
            
            // Hash password using PBKDF2
            const hash = crypto.pbkdf2Sync(
                password,
                salt,
                this.iterations,
                64,
                'sha256'
            );
            
            return {
                hash: hash.toString('hex'),
                salt: salt.toString('hex')
            };
        } catch (error) {
            logger.error('Password hashing error:', error);
            throw new Error('Password hashing failed');
        }
    }

    async verifyPassword(password, hash, salt) {
        try {
            // Convert hex strings back to buffers
            const saltBuffer = Buffer.from(salt, 'hex');
            const hashBuffer = Buffer.from(hash, 'hex');
            
            // Hash provided password
            const verifyHash = crypto.pbkdf2Sync(
                password,
                saltBuffer,
                this.iterations,
                64,
                'sha256'
            );
            
            // Compare hashes
            return crypto.timingSafeEqual(hashBuffer, verifyHash);
        } catch (error) {
            logger.error('Password verification error:', error);
            throw new Error('Password verification failed');
        }
    }

    async generateToken(length = 32) {
        try {
            return crypto.randomBytes(length).toString('hex');
        } catch (error) {
            logger.error('Token generation error:', error);
            throw new Error('Token generation failed');
        }
    }

    async hashData(data) {
        try {
            const hash = crypto.createHash('sha256');
            hash.update(JSON.stringify(data));
            return hash.digest('hex');
        } catch (error) {
            logger.error('Data hashing error:', error);
            throw new Error('Data hashing failed');
        }
    }
}

module.exports = new EncryptionService(); 