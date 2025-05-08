// services/paymentGatewayService.js
const PaymentGateway = require('../models/PaymentGateway');
const { sequelize } = require('../config/db');

/**
 * Get all active payment gateways
 * @param {boolean} forDeposit - If true, return gateways for deposit, else for withdrawal
 * @returns {Array} - List of active payment gateways
 */
const getActivePaymentGateways = async (forDeposit = true) => {
  try {
    const gateways = await PaymentGateway.findAll({
      where: {
        is_active: true,
        [forDeposit ? 'supports_deposit' : 'supports_withdrawal']: true
      },
      order: [['display_order', 'ASC']]
    });
    
    return {
      success: true,
      gateways: gateways
    };
  } catch (error) {
    console.error('Error fetching payment gateways:', error);
    return {
      success: false,
      message: 'Failed to fetch payment gateways'
    };
  }
};

/**
 * Get a payment gateway by code
 * @param {string} code - Gateway code
 * @returns {Object} - Payment gateway details
 */
const getPaymentGatewayByCode = async (code) => {
  try {
    const gateway = await PaymentGateway.findOne({
      where: { code }
    });
    
    if (!gateway) {
      return {
        success: false,
        message: 'Payment gateway not found'
      };
    }
    
    return {
      success: true,
      gateway
    };
  } catch (error) {
    console.error('Error fetching payment gateway:', error);
    return {
      success: false,
      message: 'Failed to fetch payment gateway'
    };
  }
};

/**
 * Create a new payment gateway
 * @param {Object} gatewayData - Gateway data
 * @returns {Object} - Created gateway
 */
const createPaymentGateway = async (gatewayData) => {
  const t = await sequelize.transaction();
  
  try {
    // Check if gateway with same code already exists
    const existingGateway = await PaymentGateway.findOne({
      where: { code: gatewayData.code },
      transaction: t
    });
    
    if (existingGateway) {
      await t.rollback();
      return {
        success: false,
        message: 'Payment gateway with this code already exists'
      };
    }
    
    // Create new gateway
    const gateway = await PaymentGateway.create(gatewayData, { transaction: t });
    
    await t.commit();
    
    return {
      success: true,
      message: 'Payment gateway created successfully',
      gateway
    };
  } catch (error) {
    await t.rollback();
    console.error('Error creating payment gateway:', error);
    return {
      success: false,
      message: 'Failed to create payment gateway'
    };
  }
};

/**
 * Update a payment gateway
 * @param {number} gatewayId - Gateway ID
 * @param {Object} gatewayData - Updated gateway data
 * @returns {Object} - Update result
 */
const updatePaymentGateway = async (gatewayId, gatewayData) => {
  const t = await sequelize.transaction();
  
  try {
    // Check if gateway exists
    const gateway = await PaymentGateway.findByPk(gatewayId, { transaction: t });
    
    if (!gateway) {
      await t.rollback();
      return {
        success: false,
        message: 'Payment gateway not found'
      };
    }
    
    // If code is changing, make sure it's not a duplicate
    if (gatewayData.code && gatewayData.code !== gateway.code) {
      const existingGateway = await PaymentGateway.findOne({
        where: { code: gatewayData.code },
        transaction: t
      });
      
      if (existingGateway) {
        await t.rollback();
        return {
          success: false,
          message: 'Another payment gateway with this code already exists'
        };
      }
    }
    
    // Update gateway
    await gateway.update(gatewayData, { transaction: t });
    
    await t.commit();
    
    return {
      success: true,
      message: 'Payment gateway updated successfully',
      gateway
    };
  } catch (error) {
    await t.rollback();
    console.error('Error updating payment gateway:', error);
    return {
      success: false,
      message: 'Failed to update payment gateway'
    };
  }
};

/**
 * Toggle active status of a payment gateway
 * @param {number} gatewayId - Gateway ID
 * @returns {Object} - Toggle result
 */
const togglePaymentGatewayStatus = async (gatewayId) => {
  const t = await sequelize.transaction();
  
  try {
    // Check if gateway exists
    const gateway = await PaymentGateway.findByPk(gatewayId, { transaction: t });
    
    if (!gateway) {
      await t.rollback();
      return {
        success: false,
        message: 'Payment gateway not found'
      };
    }
    
    // Toggle active status
    await gateway.update({ is_active: !gateway.is_active }, { transaction: t });
    
    await t.commit();
    
    return {
      success: true,
      message: `Payment gateway ${gateway.is_active ? 'activated' : 'deactivated'} successfully`,
      isActive: gateway.is_active
    };
  } catch (error) {
    await t.rollback();
    console.error('Error toggling payment gateway status:', error);
    return {
      success: false,
      message: 'Failed to toggle payment gateway status'
    };
  }
};

/**
 * Initialize default payment gateways
 * @returns {Object} - Result
 */
const initializeDefaultGateways = async () => {
  const t = await sequelize.transaction();
  
  try {
    // Check if gateways already exist
    const existingCount = await PaymentGateway.count({ transaction: t });
    
    if (existingCount > 0) {
      await t.rollback();
      return {
        success: true,
        message: 'Payment gateways already initialized'
      };
    }
    
    // Create default gateways
    await PaymentGateway.bulkCreate([
      {
        name: 'OKPAY',
        code: 'OKPAY',
        description: 'Original payment gateway integration',
        logo_url: '/assets/images/payment/okpay.png',
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true,
        min_deposit: 100.00,
        max_deposit: 100000.00,
        min_withdrawal: 500.00,
        max_withdrawal: 50000.00,
        display_order: 1
      },
      {
        name: 'WePayGlobal',
        code: 'WEPAY',
        description: 'International payment gateway with multiple options',
        logo_url: '/assets/images/payment/wepay.png',
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true,
        min_deposit: 100.00,
        max_deposit: 100000.00,
        min_withdrawal: 500.00,
        max_withdrawal: 50000.00,
        display_order: 2
      }
    ], { transaction: t });
    
    await t.commit();
    
    return {
      success: true,
      message: 'Default payment gateways initialized'
    };
  } catch (error) {
    await t.rollback();
    console.error('Error initializing default payment gateways:', error);
    return {
      success: false,
      message: 'Failed to initialize default payment gateways'
    };
  }
};

module.exports = {
  getActivePaymentGateways,
  getPaymentGatewayByCode,
  createPaymentGateway,
  updatePaymentGateway,
  togglePaymentGatewayStatus,
  initializeDefaultGateways
};