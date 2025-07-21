const { getAllPendingRecharges, getAllSuccessfulRecharges, getFirstRecharges, getTodayTopDeposits, getTodayTopWithdrawals, processRechargeAdminAction } = require('../../services/paymentService');

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
 * Process recharge approval/rejection action
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processRechargeActionController = async (req, res) => {
  try {
    const { recharge_id, action, notes } = req.body;
    const adminId = req.user.user_id;
    
    if (!recharge_id || !action) {
      return res.status(400).json({
        success: false,
        message: 'Recharge ID and action are required'
      });
    }
    
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be either "approve" or "reject"'
      });
    }
    
    if (action === 'reject' && !notes) {
      return res.status(400).json({
        success: false,
        message: 'Notes are required when rejecting a recharge'
      });
    }
    
    const result = await processRechargeAdminAction(
      adminId,
      recharge_id,
      action,
      notes || ''
    );
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error processing recharge action:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing recharge action'
    });
  }
};

/**
 * Get all successful recharge requests
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
 * Get first-time recharge requests
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
    console.error('Error fetching today top deposits:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching today top deposits'
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
    console.error('Error fetching today top withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching today top withdrawals'
    });
  }
};

module.exports = {
  getAllPendingRechargesController,
  processRechargeActionController,
  getAllSuccessfulRechargesController,
  getFirstRechargesController,
  getTodayTopDepositsController,
  getTodayTopWithdrawalsController
}; 