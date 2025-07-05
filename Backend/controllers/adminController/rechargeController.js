const { getAllPendingRecharges, getAllSuccessfulRecharges, getFirstRecharges, getTodayTopDeposits, getTodayTopWithdrawals } = require('../../services/paymentService');

/**
 * Get all pending recharge requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllPendingRechargesController = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await getAllPendingRecharges(parseInt(page), parseInt(limit));
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error fetching pending recharges:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching pending recharges'
    });
  }
};

/**
 * Get all successful recharges
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllSuccessfulRechargesController = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await getAllSuccessfulRecharges(parseInt(page), parseInt(limit));
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error fetching successful recharges:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching successful recharges'
    });
  }
};

/**
 * Get successful first-time recharges
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFirstRechargesController = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await getFirstRecharges(parseInt(page), parseInt(limit));
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error fetching first recharges:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching first recharges'
    });
  }
};

/**
 * Get today's top deposits
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTodayTopDepositsController = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await getTodayTopDeposits(parseInt(page), parseInt(limit));
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error fetching today\'s top deposits:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching today\'s top deposits'
    });
  }
};

/**
 * Get today's top withdrawals
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTodayTopWithdrawalsController = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await getTodayTopWithdrawals(parseInt(page), parseInt(limit));
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error fetching today\'s top withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching today\'s top withdrawals'
    });
  }
};

module.exports = {
  getAllPendingRechargesController,
  getAllSuccessfulRechargesController,
  getFirstRechargesController,
  getTodayTopDepositsController,
  getTodayTopWithdrawalsController
}; 