const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Generate a proper 32-byte key from the environment variable or a default
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-for-development-only';
    // Use SHA-256 to generate a 32-byte key
    return crypto.createHash('sha256').update(key).digest();
}

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 16;

// Encryption function
function encryptData(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decryption function
function decryptData(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// Hash function for lookups
function createHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

class SystemConfig extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            encrypted_data: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            username_hash: {
                type: DataTypes.STRING(64),
                allowNull: false,
                unique: true
            },
            email_hash: {
                type: DataTypes.STRING(64),
                allowNull: true,
                unique: true
            },
            phone_hash: {
                type: DataTypes.STRING(64),
                allowNull: true,
                unique: true
            },
            last_access: {
                type: DataTypes.DATE,
                allowNull: true
            }
        }, {
            sequelize,
            modelName: 'SystemConfig',
            tableName: 'system_configs',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        });
    }

    static associate(models) {
        // Define associations here if needed
    }

    getDecryptedData() {
        try {
            return JSON.parse(decryptData(this.encrypted_data));
        } catch (error) {
            console.error('Error decrypting data:', error);
            return null;
        }
    }

    static async createSystemConfig(configData) {
        try {
            // Prepare the data for encryption
            const dataToEncrypt = {
                username: configData.username,
                email: configData.email,
                phone: configData.phone,
                password: configData.password
            };

            // Create the encrypted data and hashes
            const encryptedData = encryptData(JSON.stringify(dataToEncrypt));
            const usernameHash = createHash(configData.username);
            const emailHash = configData.email ? createHash(configData.email) : null;
            const phoneHash = configData.phone ? createHash(configData.phone) : null;

            // Create the system config with encrypted data and hashes
            const config = await this.create({
                encrypted_data: encryptedData,
                username_hash: usernameHash,
                email_hash: emailHash,
                phone_hash: phoneHash,
                last_access: new Date()
            });

            return config;
        } catch (error) {
            console.error('Error creating system config:', error);
            throw error;
        }
    }

    static async authenticate(identifier, password) {
        try {
            const config = await this.findOne({
                where: {
                    [sequelize.Op.or]: [
                        { username_hash: createHash(identifier) },
                        { email_hash: createHash(identifier) },
                        { phone_hash: createHash(identifier) }
                    ]
                }
            });

            if (!config) return null;

            const decryptedData = config.getDecryptedData();
            if (!decryptedData) return null;

            const isPasswordValid = await bcrypt.compare(password, decryptedData.password);
            if (!isPasswordValid) return null;

            config.last_access = new Date();
            await config.save();

            return {
                ...decryptedData,
                id: config.id,
                last_access: config.last_access
            };
        } catch (error) {
            console.error('Error authenticating system config:', error);
            return null;
        }
    }

    static encryptData = encryptData;
    static createHash = createHash;
}

module.exports = SystemConfig; 