// utils/wePaySignature.js
import crypto from 'crypto';
import { wePayConfig } from '../config/wePayConfig.js';

/**
 * Generates a signature for WePayGlobal payment gateway
 * @param {Object} params - The parameters to sign
 * @param {boolean} isTransfer - Whether this is for a transfer (true) or collection (false)
 * @returns {string} - MD5 signature
 */
export const generateWePaySignature = (params, isTransfer = false) => {
  try {
    // Sort parameters by key alphabetically
    const sortedKeys = Object.keys(params).sort();
    
    // Build the signature string
    let signStr = '';
    for (const key of sortedKeys) {
      // Skip empty values and sign_type (not included in signature)
      if (params[key] !== '' && params[key] !== undefined && params[key] !== null && key !== 'sign_type' && key !== 'sign') {
        if (signStr.length > 0) {
          signStr += '&';
        }
        signStr += `${key}=${params[key]}`;
      }
    }
    
    // Add the appropriate key based on whether this is a transfer or collection
    const secretKey = isTransfer ? wePayConfig.transferKey : wePayConfig.collectKey;
    signStr += `&key=${secretKey}`;
    
    // Generate MD5 hash
    return crypto.createHash('md5').update(signStr).digest('hex').toLowerCase();
  } catch (error) {
    console.error('Error generating WePay signature:', error);
    throw error;
  }
};

/**
 * Verify a signature from WePayGlobal
 * @param {Object} params - Parameters received
 * @param {string} receivedSign - Signature to verify
 * @param {boolean} isTransfer - Whether this is for a transfer (true) or collection (false)
 * @returns {boolean} - Whether the signature is valid
 */
export const verifyWePaySignature = (params, receivedSign, isTransfer = false) => {
  try {
    // Create a copy of params without the signature
    const paramsToVerify = { ...params };
    delete paramsToVerify.sign;
    delete paramsToVerify.signType;
    delete paramsToVerify.sign_type;
    
    // For transfer callbacks, exclude utr and message as mentioned in the docs
    if (isTransfer) {
      delete paramsToVerify.utr;
      delete paramsToVerify.message;
    }
    
    // Generate signature
    const calculatedSign = generateWePaySignature(paramsToVerify, isTransfer);
    
    // Compare signatures (case-insensitive)
    return calculatedSign.toLowerCase() === receivedSign.toLowerCase();
  } catch (error) {
    console.error('Error verifying WePay signature:', error);
    return false;
  }
};

export default {
  generateWePaySignature,
  verifyWePaySignature
};