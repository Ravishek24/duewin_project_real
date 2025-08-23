const crypto = require('crypto');

/**
 * Casino API Encryption Service
 * Handles AES-256 encryption/decryption for casino API integration
 */
class CasinoEncryption {
  constructor(aesKey) {
    this.aesKey = aesKey;
    
    // Determine algorithm based on key length
    const keyBuffer = Buffer.from(aesKey, 'hex');
    if (keyBuffer.length === 16) {
      this.algorithm = 'aes-128-ecb';
      console.log('🔐 Casino encryption initialized with AES-128-ECB (16-byte key)');
    } else {
      this.algorithm = 'aes-256-ecb';
      console.log('🔐 Casino encryption initialized with AES-256-ECB (32-byte key)');
    }
    
    console.log(`🔑 Key length: ${keyBuffer.length} bytes`);
  }

  /**
   * Encrypt data using AES-256-ECB
   * @param {string} data - Data to encrypt
   * @returns {string} Base64 encoded encrypted data
   */
  encrypt(data) {
    try {
      // Convert data to string if it's an object
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Create cipher using modern method (AES-256-ECB)
      // Convert hex key to buffer and ensure it's 32 bytes for AES-256
      let keyBuffer = Buffer.from(this.aesKey, 'hex');
      
      // If key is less than 32 bytes, pad it or use AES-128
      if (keyBuffer.length === 16) {
        // Use AES-128-ECB for 16-byte keys
        const cipher = crypto.createCipheriv('aes-128-ecb', keyBuffer, null);
        
        // Encrypt data
        let encrypted = cipher.update(dataString, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        return encrypted;
      } else if (keyBuffer.length < 32) {
        // Pad key to 32 bytes by repeating it
        const paddedKey = Buffer.alloc(32);
        let offset = 0;
        while (offset < 32) {
          const remainingBytes = 32 - offset;
          const bytesToCopy = Math.min(keyBuffer.length, remainingBytes);
          keyBuffer.copy(paddedKey, offset, 0, bytesToCopy);
          offset += bytesToCopy;
        }
        keyBuffer = paddedKey;
      } else if (keyBuffer.length > 32) {
        // Truncate key to 32 bytes
        keyBuffer = keyBuffer.slice(0, 32);
      }
      
      const cipher = crypto.createCipheriv('aes-256-ecb', keyBuffer, null);
      
      // Encrypt data
      let encrypted = cipher.update(dataString, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      return encrypted;
    } catch (error) {
      console.error('Casino encryption error:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using AES-256-ECB
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @returns {string} Decrypted data
   */
  decrypt(encryptedData) {
    try {
      // Create decipher using modern method (AES-256-ECB)
      // Convert hex key to buffer and ensure it's 32 bytes for AES-256
      let keyBuffer = Buffer.from(this.aesKey, 'hex');
      
      // If key is less than 32 bytes, pad it or use AES-128
      if (keyBuffer.length === 16) {
        // Use AES-128-ECB for 16-byte keys
        const decipher = crypto.createDecipheriv('aes-128-ecb', keyBuffer, null);
        
        // Decrypt data
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        // Remove PKCS7 padding
        const paddingLength = decrypted.charCodeAt(decrypted.length - 1);
        if (paddingLength <= 16) {
          decrypted = decrypted.slice(0, -paddingLength);
        }
        
        return decrypted;
      } else if (keyBuffer.length < 32) {
        // Pad key to 32 bytes by repeating it
        const paddedKey = Buffer.alloc(32);
        let offset = 0;
        while (offset < 32) {
          const remainingBytes = 32 - offset;
          const bytesToCopy = Math.min(keyBuffer.length, remainingBytes);
          keyBuffer.copy(paddedKey, offset, 0, bytesToCopy);
          offset += bytesToCopy;
        }
        keyBuffer = paddedKey;
      } else if (keyBuffer.length > 32) {
        // Truncate key to 32 bytes
        keyBuffer = keyBuffer.slice(0, 32);
      }
      
      const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuffer, null);
      
      // Decrypt data
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Remove PKCS7 padding
      const paddingLength = decrypted.charCodeAt(decrypted.length - 1);
      if (paddingLength <= 16) {
        decrypted = decrypted.slice(0, -paddingLength);
      }
      
      return decrypted;
    } catch (error) {
      console.error('Casino decryption error:', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt payload for API request
   * @param {Object} payload - Payload to encrypt
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
      console.error('Payload encryption error:', error);
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
      console.error('Payload decryption error:', error);
      throw error;
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
      console.error('Timestamp validation error:', error);
      return false;
    }
  }
}

module.exports = CasinoEncryption;
