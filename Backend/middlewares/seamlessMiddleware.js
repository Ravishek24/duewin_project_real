// middlewares/seamlessMiddleware.js - FIXED VERSION
const { validateSeamlessSignature } = require('../utils/seamlessUtils');

/**
 * FIXED: Middleware to validate Seamless API request signatures
 */
const validateSeamlessRequest = (req, res, next) => {
  try {
    console.log('=== SIGNATURE VALIDATION ===');
    console.log('Request query:', req.query);
    console.log('Salt key configured:', !!process.env.SEAMLESS_SALT_KEY);
    
    // For development/testing, you might want to temporarily bypass signature validation
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_SIGNATURE_VALIDATION === 'true') {
      console.log('⚠️ BYPASSING SIGNATURE VALIDATION FOR DEVELOPMENT');
      return next();
    }
    
    const isValid = validateSeamlessSignature(req.query);
    console.log('Signature validation result:', isValid);
    
    if (!isValid) {
      console.error('Invalid signature for seamless request');
      return res.status(200).json({
        status: '403',
        msg: 'Invalid signature'
      });
    }
    
    console.log('✅ Signature validation passed');
    next();
  } catch (error) {
    console.error('Error validating seamless request:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};

/**
 * Middleware to log all seamless requests for debugging
 */
const logSeamlessRequest = (req, res, next) => {
  console.log('=== SEAMLESS REQUEST LOG ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', req.query);
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);
  console.log('IP:', req.ip);
  console.log('================================');
  next();
};

module.exports = {
  validateSeamlessRequest,
  logSeamlessRequest
};