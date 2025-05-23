// controllers/spribeController.js
const {
    getGameLaunchUrl,
    handleAuth,
    handlePlayerInfo,
    handleWithdraw,
    handleDeposit,
    handleRollback,
    listGames
} = require('../services/spribeService');
const { validateSignature } = require('../utils/spribeUtils');
const spribeService = require('../services/spribeService');

/**
 * Get a list of available SPRIBE games
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGamesController = async (req, res) => {
    try {
        const result = await listGames();
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error getting games list:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving games list'
        });
    }
};

/**
 * Get game launch URL for a specific game
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLaunchUrlController = async (req, res) => {
    try {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        
        const result = await getGameLaunchUrl(gameId, userId, req);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error generating game launch URL:', error);
        res.status(500).json({
            success: false,
            message: 'Server error generating game launch URL'
        });
    }
};

/**
 * Handle authentication request from SPRIBE
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const authCallbackController = async (req, res) => {
    try {
        // Verify the request signature
        const clientId = req.header('X-Spribe-Client-ID');
        const timestamp = req.header('X-Spribe-Client-TS');
        const signature = req.header('X-Spribe-Client-Signature');
        
        // Get the full path including query parameters
        const fullPath = req.originalUrl;
        
        // Validate signature
        const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
        
        if (!isValidSignature) {
            return res.status(200).json({
                code: 413,
                message: 'Invalid Client-Signature'
            });
        }
        
        // Process authentication request
        const result = await handleAuth(req.body);
        
        // Always return HTTP 200 with proper SPRIBE response codes
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error handling auth callback:', error);
        res.status(200).json({
            code: 500,
            message: 'Internal server error'
        });
    }
};

/**
 * Handle player info request from SPRIBE
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const infoCallbackController = async (req, res) => {
    try {
        // Verify the request signature
        const clientId = req.header('X-Spribe-Client-ID');
        const timestamp = req.header('X-Spribe-Client-TS');
        const signature = req.header('X-Spribe-Client-Signature');
        
        // Get the full path including query parameters
        const fullPath = req.originalUrl;
        
        // Validate signature
        const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
        
        if (!isValidSignature) {
            return res.status(200).json({
                code: 413,
                message: 'Invalid Client-Signature'
            });
        }
        
        // Process player info request
        const result = await handlePlayerInfo(req.body);
        
        // Always return HTTP 200 with proper SPRIBE response codes
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error handling info callback:', error);
        res.status(200).json({
            code: 500,
            message: 'Internal server error'
        });
    }
};

/**
 * Handle withdraw request from SPRIBE (betting)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const withdrawCallbackController = async (req, res) => {
    try {
        // Verify the request signature
        const clientId = req.header('X-Spribe-Client-ID');
        const timestamp = req.header('X-Spribe-Client-TS');
        const signature = req.header('X-Spribe-Client-Signature');
        
        // Get the full path including query parameters
        const fullPath = req.originalUrl;
        
        // Validate signature
        const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
        
        if (!isValidSignature) {
            return res.status(200).json({
                code: 413,
                message: 'Invalid Client-Signature'
            });
        }
        
        // Process withdraw request
        const result = await handleWithdraw(req.body);
        
        // Always return HTTP 200 with proper SPRIBE response codes
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error handling withdraw callback:', error);
        res.status(200).json({
            code: 500,
            message: 'Internal server error'
        });
    }
};

/**
 * Handle deposit request from SPRIBE (winning)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const depositCallbackController = async (req, res) => {
    try {
        // Verify the request signature
        const clientId = req.header('X-Spribe-Client-ID');
        const timestamp = req.header('X-Spribe-Client-TS');
        const signature = req.header('X-Spribe-Client-Signature');
        
        // Get the full path including query parameters
        const fullPath = req.originalUrl;
        
        // Validate signature
        const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
        
        if (!isValidSignature) {
            return res.status(200).json({
                code: 413,
                message: 'Invalid Client-Signature'
            });
        }
        
        // Process deposit request
        const result = await handleDeposit(req.body);
        
        // Always return HTTP 200 with proper SPRIBE response codes
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error handling deposit callback:', error);
        res.status(200).json({
            code: 500,
            message: 'Internal server error'
        });
    }
};

/**
 * Handle rollback request from SPRIBE
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rollbackCallbackController = async (req, res) => {
    try {
        // Verify the request signature
        const clientId = req.header('X-Spribe-Client-ID');
        const timestamp = req.header('X-Spribe-Client-TS');
        const signature = req.header('X-Spribe-Client-Signature');
        
        // Get the full path including query parameters
        const fullPath = req.originalUrl;
        
        // Validate signature
        const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
        
        if (!isValidSignature) {
            return res.status(200).json({
                code: 413,
                message: 'Invalid Client-Signature'
            });
        }
        
        // Process rollback request
        const result = await handleRollback(req.body);
        
        // Always return HTTP 200 with proper SPRIBE response codes
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error handling rollback callback:', error);
        res.status(200).json({
            code: 500,
            message: 'Internal server error'
        });
    }
};

/**
 * Unified callback handler for Spribe
 * 
 * This single endpoint replaces the multiple endpoints that were previously used
 * for different Spribe operations (auth, player info, withdraw, deposit, rollback).
 * 
 * How it works:
 * 1. Spribe sends all callback requests to this single endpoint
 * 2. Each request includes an 'action' field that identifies the operation type
 * 3. Based on the action type, we route the request to the appropriate handler in spribeService
 * 
 * Expected action types from Spribe:
 * - 'auth': Player authentication
 * - 'player_info': Retrieve player information
 * - 'withdraw': Deduct money from player's wallet (betting)
 * - 'deposit': Add money to player's wallet (winning)
 * - 'rollback': Reverse a previous transaction
 * 
 * The spribeUtils.generateGameLaunchUrl function includes this callback URL
 * in the game launch parameters, so Spribe knows where to send all requests.
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const handleCallback = async (req, res) => {
  try {
    // IMPORTANT: Verify the request signature first (per Spribe v1.9.0 requirements)
    const clientId = req.header('X-Spribe-Client-ID');
    const timestamp = req.header('X-Spribe-Client-TS');
    const signature = req.header('X-Spribe-Client-Signature');
    
    // Get the full path including query parameters
    const fullPath = req.originalUrl;
    
    // Log incoming headers for debugging
    console.log('Incoming Spribe headers:', { 
      clientId, 
      timestamp, 
      signature,
      path: fullPath
    });
    
    // Validate signature
    const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
    
    if (!isValidSignature) {
      console.error('Invalid signature in Spribe callback');
      // IMPORTANT: Per documentation, always return HTTP 200 with appropriate code
      return res.status(200).json({
        code: 413,
        message: 'Invalid Client-Signature'
      });
    }
    
    // Get the action type from the request
    const { action } = req.body;
    
    // Log the incoming request (useful for debugging)
    console.log(`Received Spribe callback with action: ${action}`, { 
      body: req.body,
      headers: req.headers
    });
    
    // Variable for the result
    let result;
    
    // Handle the request based on the action type
    switch (action) {
      case 'auth':
        result = await spribeService.handleAuth(req.body);
        break;
        
      case 'player_info':
        result = await spribeService.handlePlayerInfo(req.body);
        break;
        
      case 'withdraw': // Betting - deduct money
        result = await spribeService.handleWithdraw(req.body);
        break;
        
      case 'deposit': // Winning - add money
        result = await spribeService.handleDeposit(req.body);
        break;
        
      case 'rollback': // Rollback previous transaction
        result = await spribeService.handleRollback(req.body);
        break;
        
      default:
        console.error(`Unsupported Spribe action: ${action}`);
        // IMPORTANT: Per documentation, always return HTTP 200 with appropriate code
        return res.status(200).json({
          code: 400,
          message: `Unsupported action: ${action}`
        });
    }
    
    // Log the response (useful for debugging)
    console.log(`Sending Spribe callback response for action ${action}:`, result);
    
    // Always return HTTP 200 with the result from the service (per Spribe documentation)
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Error handling Spribe callback:', error);
    // IMPORTANT: Per documentation, always return HTTP 200 with appropriate code
    return res.status(200).json({
      code: 500,
      message: 'Internal server error'
    });
  }
};

module.exports = {
    getGamesController,
    getLaunchUrlController,
    authCallbackController,
    infoCallbackController,
    withdrawCallbackController,
    depositCallbackController,
    rollbackCallbackController,
    handleCallback
};