// controllers/paymentGatewayController.js
const { 
    getActivePaymentGateways,
    getPaymentGatewayByCode,
    createPaymentGateway,
    updatePaymentGateway,
    togglePaymentGatewayStatus,
    initializeDefaultGateways
  } = require('../services/paymentGatewayService');
  
  /**
   * Get all active payment gateways
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getActiveGatewaysController = async (req, res) => {
    try {
      const { type = 'deposit' } = req.query;
      const forDeposit = type !== 'withdrawal';
      
      const result = await getActivePaymentGateways(forDeposit);
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error fetching payment gateways:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching payment gateways'
      });
    }
  };
  
  /**
   * Get a payment gateway by code
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getGatewayByCodeController = async (req, res) => {
    try {
      const { code } = req.params;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Gateway code is required'
        });
      }
      
      const result = await getPaymentGatewayByCode(code);
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Error fetching payment gateway:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching payment gateway'
      });
    }
  };
  
  /**
   * Create a new payment gateway (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const createGatewayController = async (req, res) => {
    try {
      const { 
        name, 
        code, 
        description,
        logo_url,
        is_active,
        supports_deposit,
        supports_withdrawal,
        min_deposit,
        max_deposit,
        min_withdrawal,
        max_withdrawal,
        display_order
      } = req.body;
      
      // Validate required fields
      if (!name || !code) {
        return res.status(400).json({
          success: false,
          message: 'Name and code are required'
        });
      }
      
      // Create the gateway
      const result = await createPaymentGateway({
        name,
        code,
        description,
        logo_url,
        is_active: is_active !== undefined ? is_active : true,
        supports_deposit: supports_deposit !== undefined ? supports_deposit : true,
        supports_withdrawal: supports_withdrawal !== undefined ? supports_withdrawal : true,
        min_deposit: min_deposit || 100.00,
        max_deposit: max_deposit || 100000.00,
        min_withdrawal: min_withdrawal || 500.00,
        max_withdrawal: max_withdrawal || 50000.00,
        display_order: display_order || 0
      });
      
      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error creating payment gateway:', error);
      res.status(500).json({
        success: false,
        message: 'Server error creating payment gateway'
      });
    }
  };
  
  /**
   * Update a payment gateway (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const updateGatewayController = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name, 
        code, 
        description,
        logo_url,
        is_active,
        supports_deposit,
        supports_withdrawal,
        min_deposit,
        max_deposit,
        min_withdrawal,
        max_withdrawal,
        display_order
      } = req.body;
      
      // Validate gateway ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Gateway ID is required'
        });
      }
      
      // Update the gateway
      const result = await updatePaymentGateway(id, {
        name,
        code,
        description,
        logo_url,
        is_active,
        supports_deposit,
        supports_withdrawal,
        min_deposit,
        max_deposit,
        min_withdrawal,
        max_withdrawal,
        display_order
      });
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Error updating payment gateway:', error);
      res.status(500).json({
        success: false,
        message: 'Server error updating payment gateway'
      });
    }
  };
  
  /**
   * Toggle a payment gateway's active status (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const toggleGatewayStatusController = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate gateway ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Gateway ID is required'
        });
      }
      
      // Toggle the gateway status
      const result = await togglePaymentGatewayStatus(id);
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Error toggling payment gateway status:', error);
      res.status(500).json({
        success: false,
        message: 'Server error toggling payment gateway status'
      });
    }
  };
  
  /**
   * Initialize default payment gateways (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const initializeDefaultGatewaysController = async (req, res) => {
    try {
      const result = await initializeDefaultGateways();
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error initializing default payment gateways:', error);
      res.status(500).json({
        success: false,
        message: 'Server error initializing default payment gateways'
      });
    }
  };
  
  module.exports = {
    getActiveGatewaysController,
    getGatewayByCodeController,
    createGatewayController,
    updateGatewayController,
    toggleGatewayStatusController,
    initializeDefaultGatewaysController
  };