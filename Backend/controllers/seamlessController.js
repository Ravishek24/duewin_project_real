// controllers/seamlessController.js
const { validateSeamlessSignature } = require('../utils/seamlessUtils');
const {
  getGameList,
  getGameUrl,
  createPlayer,
  processBalanceRequest,
  processDebitRequest,
  processCreditRequest,
  processRollbackRequest,
  addFreeRounds,
  removeFreeRounds
} = require('../services/seamlessWalletService');

/**
 * Controller to fetch list of available games
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGamesController = async (req, res) => {
  try {
    const { currency } = req.query;
    const result = await getGameList(currency);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in getGamesController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching games list'
    });
  }
};

/**
 * Controller to launch a game and get the game URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const launchGameController = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { language } = req.query;
    const userId = req.user.user_id;
    
    const result = await getGameUrl(userId, gameId, language);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in launchGameController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error launching game'
    });
  }
};

/**
 * Controller to handle wallet balance requests from the game provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const balanceCallbackController = async (req, res) => {
  try {
    // Process the balance request
    const result = await processBalanceRequest(req.query);
    
    // Return the result
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in balanceCallbackController:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};

/**
 * Controller to handle debit (bet) requests from the game provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const debitCallbackController = async (req, res) => {
  try {
    // Process the debit request
    const result = await processDebitRequest(req.query);
    
    // Return the result
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in debitCallbackController:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};

/**
 * Controller to handle credit (win) requests from the game provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const creditCallbackController = async (req, res) => {
  try {
    // Process the credit request
    const result = await processCreditRequest(req.query);
    
    // Return the result
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in creditCallbackController:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};

/**
 * Controller to handle rollback requests from the game provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rollbackCallbackController = async (req, res) => {
  try {
    // Process the rollback request
    const result = await processRollbackRequest(req.query);
    
    // Return the result
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in rollbackCallbackController:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};

/**
 * Controller to add free rounds to players (admin use)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addFreeRoundsController = async (req, res) => {
  try {
    const {
      title,
      playerIds,
      gameIds,
      available,
      validTo,
      validFrom,
      betLevel
    } = req.body;
    
    // Validate required fields
    if (!title || !playerIds || !gameIds || !available || !validTo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const result = await addFreeRounds(
      title,
      playerIds,
      gameIds,
      available,
      validTo,
      validFrom,
      betLevel
    );
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in addFreeRoundsController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding free rounds'
    });
  }
};

/**
 * Controller to remove free rounds from players (admin use)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removeFreeRoundsController = async (req, res) => {
  try {
    const {
      title,
      playerIds,
      gameIds
    } = req.body;
    
    // Validate required fields
    if (!title || !playerIds || !gameIds) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const result = await removeFreeRounds(
      title,
      playerIds,
      gameIds
    );
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in removeFreeRoundsController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error removing free rounds'
    });
  }
};

module.exports = {
  getGamesController,
  launchGameController,
  balanceCallbackController,
  debitCallbackController,
  creditCallbackController,
  rollbackCallbackController,
  addFreeRoundsController,
  removeFreeRoundsController
};