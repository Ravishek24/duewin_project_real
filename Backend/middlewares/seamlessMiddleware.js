// middlewares/seamlessMiddleware.js
import { validateSeamlessSignature } from '../utils/seamlessUtils.js';

/**
 * Middleware to validate Seamless API request signatures
 */
export const validateSeamlessRequest = (req, res, next) => {
  try {
    const isValid = validateSeamlessSignature(req.query);
    
    if (!isValid) {
      return res.status(200).json({
        status: '403',
        msg: 'Invalid signature'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error validating seamless request:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};

export default validateSeamlessRequest;