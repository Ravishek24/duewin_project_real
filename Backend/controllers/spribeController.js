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

module.exports = {
    getGamesController,
    getLaunchUrlController,
    authCallbackController,
    infoCallbackController,
    withdrawCallbackController,
    depositCallbackController,
    rollbackCallbackController
};