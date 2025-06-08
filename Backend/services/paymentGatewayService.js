// services/paymentGatewayService.js
const { sequelize } = require('../config/db');
const moment = require('moment-timezone');
const { Op } = require('sequelize');

// Initialize models
let PaymentGateway;
let PaymentGatewaySettings;
let WalletRecharge;
let WalletWithdrawal;

const initializeModels = async () => {
  try {
    PaymentGateway = require('../models/PaymentGateway');
    PaymentGatewaySettings = require('../models/PaymentGatewaySettings');
    WalletRecharge = require('../models/WalletRecharge');
    WalletWithdrawal = require('../models/WalletWithdrawal');
    
    // Verify models are properly initialized
    if (!PaymentGateway || !PaymentGatewaySettings) {
      throw new Error('Required models not initialized');
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing payment gateway models:', error);
    throw error;
  }
};

/**
 * Get all active payment gateways
 * @param {boolean} forDeposit - If true, return gateways for deposit, else for withdrawal
 * @returns {Array} - List of active payment gateways
 */
const getActivePaymentGateways = async (forDeposit = true) => {
  try {
    await initializeModels();
    
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
    await initializeModels();
    
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
    await initializeModels();
    
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
    await initializeModels();
    
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
    await initializeModels();
    
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
  try {
    await initializeModels();
    
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
        },
        {
          name: 'MxPay',
          code: 'MXPAY',
          description: 'Secure payment gateway for deposits and withdrawals',
          logo_url: '/assets/images/payment/mxpay.png',
          is_active: true,
          supports_deposit: true,
          supports_withdrawal: true,
          min_deposit: 100.00,
          max_deposit: 100000.00,
          min_withdrawal: 500.00,
          max_withdrawal: 50000.00,
          display_order: 3
        }
      ], { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        message: 'Default payment gateways initialized successfully'
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error initializing default payment gateways:', error);
    return {
      success: false,
      message: 'Failed to initialize default payment gateways'
    };
  }
};

/**
 * Get all payment gateway settings
 * @param {boolean} isAdmin - Whether the request is from admin
 * @returns {Object} - List of payment gateway settings
 */
const getAllPaymentGateways = async (isAdmin = false) => {
  try {
    await initializeModels();
    
    const whereClause = isAdmin ? {} : { is_active: true };
    
    const gateways = await PaymentGatewaySettings.findAll({
      where: whereClause,
      order: [['gateway_name', 'ASC']]
    });

    return {
      success: true,
      gateways: gateways.map(gateway => ({
        id: gateway.id,
        gateway_name: gateway.gateway_name,
        is_deposit_enabled: gateway.is_deposit_enabled,
        is_withdrawal_enabled: gateway.is_withdrawal_enabled,
        min_deposit_amount: parseFloat(gateway.min_deposit_amount),
        max_deposit_amount: parseFloat(gateway.max_deposit_amount),
        is_active: gateway.is_active
      }))
    };
  } catch (error) {
    console.error('Error getting payment gateways:', error);
    return {
      success: false,
      message: 'Error fetching payment gateways'
    };
  }
};

/**
 * Get available payment gateways for deposit
 * @returns {Object} - List of available payment gateways for deposit
 */
const getAvailableDepositGateways = async () => {
  try {
    await initializeModels();
    
    const gateways = await PaymentGatewaySettings.findAll({
      where: {
        is_active: true,
        is_deposit_enabled: true
      },
      order: [['gateway_name', 'ASC']]
    });

    return {
      success: true,
      gateways: gateways.map(gateway => ({
        gateway_name: gateway.gateway_name,
        min_amount: parseFloat(gateway.min_deposit),
        max_amount: parseFloat(gateway.max_deposit)
      }))
    };
  } catch (error) {
    console.error('Error getting available deposit gateways:', error);
    return {
      success: false,
      message: 'Error fetching available deposit gateways'
    };
  }
};

/**
 * Get available payment gateways for withdrawal
 * @returns {Object} - List of available payment gateways for withdrawal
 */
const getAvailableWithdrawalGateways = async () => {
  try {
    await initializeModels();
    
    const gateways = await PaymentGatewaySettings.findAll({
      where: {
        is_active: true,
        is_withdrawal_enabled: true
      },
      order: [['gateway_name', 'ASC']]
    });

    return {
      success: true,
      gateways: gateways.map(gateway => ({
        gateway_name: gateway.gateway_name
      }))
    };
  } catch (error) {
    console.error('Error getting available withdrawal gateways:', error);
    return {
      success: false,
      message: 'Error fetching available withdrawal gateways'
    };
  }
};

/**
 * Toggle deposit status for a payment gateway
 * @param {number} gatewayId - Gateway ID
 * @returns {Object} - Update result
 */
const toggleDepositStatus = async (gatewayId) => {
  try {
    await initializeModels();
    
    const gateway = await PaymentGatewaySettings.findByPk(gatewayId);
    
    if (!gateway) {
      return {
        success: false,
        message: 'Payment gateway not found'
      };
    }

    await gateway.update({
      is_deposit_enabled: !gateway.is_deposit_enabled
    });

    return {
      success: true,
      message: `Deposit ${gateway.is_deposit_enabled ? 'enabled' : 'disabled'} successfully`,
      gateway: {
        id: gateway.id,
        gateway_name: gateway.gateway_name,
        is_deposit_enabled: gateway.is_deposit_enabled
      }
    };
  } catch (error) {
    console.error('Error toggling deposit status:', error);
    return {
      success: false,
      message: 'Error updating deposit status'
    };
  }
};

/**
 * Toggle withdrawal status for a payment gateway
 * @param {number} gatewayId - Gateway ID
 * @returns {Object} - Update result
 */
const toggleWithdrawalStatus = async (gatewayId) => {
  try {
    await initializeModels();
    
    const gateway = await PaymentGatewaySettings.findByPk(gatewayId);
    
    if (!gateway) {
      return {
        success: false,
        message: 'Payment gateway not found'
      };
    }

    await gateway.update({
      is_withdrawal_enabled: !gateway.is_withdrawal_enabled
    });

    return {
      success: true,
      message: `Withdrawal ${gateway.is_withdrawal_enabled ? 'enabled' : 'disabled'} successfully`,
      gateway: {
        id: gateway.id,
        gateway_name: gateway.gateway_name,
        is_withdrawal_enabled: gateway.is_withdrawal_enabled
      }
    };
  } catch (error) {
    console.error('Error toggling withdrawal status:', error);
    return {
      success: false,
      message: 'Error updating withdrawal status'
    };
  }
};

/**
 * Update deposit limits for a payment gateway
 * @param {number} gatewayId - Gateway ID
 * @param {Object} limits - Min and max deposit amounts
 * @returns {Object} - Update result
 */
const updateDepositLimits = async (gatewayId, limits) => {
  try {
    await initializeModels();
    
    const gateway = await PaymentGatewaySettings.findByPk(gatewayId);
    
    if (!gateway) {
      return {
        success: false,
        message: 'Payment gateway not found'
      };
    }

    // Validate limits
    if (limits.min_deposit_amount >= limits.max_deposit_amount) {
      return {
        success: false,
        message: 'Minimum deposit amount must be less than maximum deposit amount'
      };
    }

    await gateway.update({
      min_deposit_amount: limits.min_deposit_amount,
      max_deposit_amount: limits.max_deposit_amount
    });

    return {
      success: true,
      message: 'Deposit limits updated successfully',
      gateway: {
        id: gateway.id,
        gateway_name: gateway.gateway_name,
        min_deposit_amount: parseFloat(gateway.min_deposit_amount),
        max_deposit_amount: parseFloat(gateway.max_deposit_amount)
      }
    };
  } catch (error) {
    console.error('Error updating deposit limits:', error);
    return {
      success: false,
      message: 'Error updating deposit limits'
    };
  }
};

/**
 * Get payment gateway statistics
 * @returns {Object} - Statistics for each payment gateway
 */
const getPaymentGatewayStats = async () => {
  try {
    await initializeModels();
    
    const todayIST = moment().tz('Asia/Kolkata').startOf('day');
    
    // Get all active payment gateways
    const gateways = await PaymentGateway.findAll({
      where: { is_active: true },
      attributes: ['gateway_id', 'name', 'code']
    });

    const stats = await Promise.all(gateways.map(async (gateway) => {
      // Get today's deposits
      const todayDeposits = await WalletRecharge.sum('amount', {
        where: {
          payment_gateway: gateway.code,
          created_at: {
            [Op.gte]: todayIST.toDate()
          },
          status: 'completed'
        }
      });

      // Get total deposits
      const totalDeposits = await WalletRecharge.sum('amount', {
        where: {
          payment_gateway: gateway.code,
          status: 'completed'
        }
      });

      // Get today's withdrawals
      const todayWithdrawals = await WalletWithdrawal.sum('amount', {
        where: {
          payment_gateway: gateway.code,
          created_at: {
            [Op.gte]: todayIST.toDate()
          },
          status: 'completed'
        }
      });

      // Get total withdrawals
      const totalWithdrawals = await WalletWithdrawal.sum('amount', {
        where: {
          payment_gateway: gateway.code,
          status: 'completed'
        }
      });

      return {
        gateway_id: gateway.gateway_id,
        gateway_name: gateway.name,
        gateway_code: gateway.code,
        today_deposits: todayDeposits || 0,
        total_deposits: totalDeposits || 0,
        today_withdrawals: todayWithdrawals || 0,
        total_withdrawals: totalWithdrawals || 0,
        net_amount: (totalDeposits || 0) - (totalWithdrawals || 0)
      };
    }));

    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error('Error getting payment gateway statistics:', error);
    return {
      success: false,
      message: 'Error fetching payment gateway statistics'
    };
  }
};

/**
 * Setup payment gateways
 */
const setupPaymentGateways = async () => {
    try {
        console.log('💳 Setting up payment gateways...');
        
        // Initialize models first
        await initializeModels();
        
        // Get all payment gateways
        const { success, gateways } = await getActivePaymentGateways();
        
        if (!success || !gateways || gateways.length === 0) {
            console.log('⚠️ No active payment gateways found, initializing defaults...');
            await initializeDefaultGateways();
        } else {
            console.log(`✅ Found ${gateways.length} active payment gateways`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to setup payment gateways:', error);
        return false;
    }
};

module.exports = {
  getActivePaymentGateways,
  getPaymentGatewayByCode,
  createPaymentGateway,
  updatePaymentGateway,
  togglePaymentGatewayStatus,
  initializeDefaultGateways,
  getAllPaymentGateways,
  getAvailableDepositGateways,
  getAvailableWithdrawalGateways,
  toggleDepositStatus,
  toggleWithdrawalStatus,
  updateDepositLimits,
  getPaymentGatewayStats,
  setupPaymentGateways
};