const crypto = require('crypto');

/**
 * Casino API Encryption Service - Production Ready
 * Uses confirmed working UTF-8 string key method
 */
class CasinoEncryption {
  constructor(aesKey) {
    this.aesKey = aesKey;
    
    // CONFIRMED WORKING: UTF-8 string key method
    const keyBuffer = Buffer.from(aesKey, 'utf8');
    this.key32 = Buffer.alloc(32);
    keyBuffer.copy(this.key32, 0, 0, Math.min(keyBuffer.length, 32));
    
    console.log('🔐 Casino Encryption initialized with UTF-8 string key method');
    console.log('🔑 Key length:', keyBuffer.length, 'bytes -> Extended to 32 bytes for AES-256');
  }

  /**
   * CONFIRMED WORKING: UTF-8 string key encryption with AES-256-ECB
   * @param {string} data - Data to encrypt
   * @returns {string} Base64 encoded encrypted data
   */
  encrypt(data) {
    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      
      const cipher = crypto.createCipheriv('aes-256-ecb', this.key32, null);
      cipher.setAutoPadding(true); // PKCS7 padding
      
      let encrypted = cipher.update(dataString, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      return encrypted;
    } catch (error) {
      console.error('❌ Casino encryption error:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * CONFIRMED WORKING: UTF-8 string key decryption
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @returns {string} Decrypted data
   */
  decrypt(encryptedData) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-ecb', this.key32, null);
      decipher.setAutoPadding(true);
      
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('❌ Casino decryption error:', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate timestamp in milliseconds
   * @returns {string} Current timestamp as string
   */
  generateTimestamp() {
    return Date.now().toString();
  }

  /**
   * Validate timestamp (check if it's within acceptable range)
   * @param {string} timestamp - Timestamp to validate
   * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
   * @returns {boolean} True if timestamp is valid
   */
  validateTimestamp(timestamp, maxAge = 5 * 60 * 1000) {
    try {
      const timestampNum = parseInt(timestamp);
      const currentTime = Date.now();
      const age = currentTime - timestampNum;
      
      return age >= 0 && age <= maxAge;
    } catch (error) {
      console.error('❌ Timestamp validation error:', error);
      return false;
    }
  }

  /**
   * Encrypt payload for API request with proper structure
   * @param {Object} payload - Payload to encrypt
   * @param {string} agencyUid - Agency UID
   * @param {string} timestamp - Timestamp
   * @returns {Object} Request object with encrypted payload
   */
  encryptPayload(payload, agencyUid, timestamp) {
    try {
      const encryptedPayload = this.encrypt(JSON.stringify(payload));
      
      return {
        agency_uid: agencyUid,
        timestamp: timestamp,
        payload: encryptedPayload
      };
    } catch (error) {
      console.error('❌ Payload encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypt payload from API response
   * @param {string} encryptedPayload - Encrypted payload from API
   * @returns {Object} Decrypted payload object
   */
  decryptPayload(encryptedPayload) {
    try {
      const decryptedString = this.decrypt(encryptedPayload);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('❌ Payload decryption error:', error);
      throw error;
    }
  }
}

module.exports = CasinoEncryption;