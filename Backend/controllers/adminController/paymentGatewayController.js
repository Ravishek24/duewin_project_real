const {
  getAllPaymentGateways,
  getAvailableDepositGateways,
  getAvailableWithdrawalGateways,
  toggleDepositStatus,
  toggleWithdrawalStatus,
  updateDepositLimits,
  getPaymentGatewayStats
} = require('../../services/paymentGatewayService');

/**
 * Get all payment gateways (admin only)
 * @route GET /api/admin/payment-gateways
 */
const getAllPaymentGatewaysController = async (req, res) => {
  try {
    const result = await getAllPaymentGateways(true);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in getAllPaymentGatewaysController:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get available deposit gateways
 * @route GET /api/payment-gateways/deposit
 */
const getAvailableDepositGatewaysController = async (req, res) => {
  try {
    const result = await getAvailableDepositGateways();
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in getAvailableDepositGatewaysController:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get available withdrawal gateways
 * @route GET /api/payment-gateways/withdrawal
 */
const getAvailableWithdrawalGatewaysController = async (req, res) => {
  try {
    const result = await getAvailableWithdrawalGateways();
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in getAvailableWithdrawalGatewaysController:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Toggle deposit status for a payment gateway (admin only)
 * @route PUT /api/admin/payment-gateways/:id/toggle-deposit
 */
const toggleDepositStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await toggleDepositStatus(id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in toggleDepositStatusController:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Toggle withdrawal status for a payment gateway (admin only)
 * @route PUT /api/admin/payment-gateways/:id/toggle-withdrawal
 */
const toggleWithdrawalStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await toggleWithdrawalStatus(id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in toggleWithdrawalStatusController:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update deposit limits for a payment gateway (admin only)
 * @route PUT /api/admin/payment-gateways/:id/deposit-limits
 */
const updateDepositLimitsController = async (req, res) => {
  try {
    const { id } = req.params;
    const { min_deposit_amount, max_deposit_amount } = req.body;

    // Validate required fields
    if (min_deposit_amount === undefined || max_deposit_amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Minimum and maximum deposit amounts are required'
      });
    }

    const result = await updateDepositLimits(id, {
      min_deposit_amount,
      max_deposit_amount
    });
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in updateDepositLimitsController:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get payment gateway statistics (admin only)
 * @route GET /api/admin/payment-gateways/stats
 */
const getPaymentGatewayStatsController = async (req, res) => {
  try {
    const result = await getPaymentGatewayStats();
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in getPaymentGatewayStatsController:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllPaymentGatewaysController,
  getAvailableDepositGatewaysController,
  getAvailableWithdrawalGatewaysController,
  toggleDepositStatusController,
  toggleWithdrawalStatusController,
  updateDepositLimitsController,
  getPaymentGatewayStatsController
}; 