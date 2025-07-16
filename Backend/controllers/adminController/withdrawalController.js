// controllers/adminController/withdrawalController.js
const {
    getPendingWithdrawals,
    getWithdrawalsAdmin,
    processWithdrawalAdminAction
  } = require('../../services/paymentService');
  
  /**
   * Get pending withdrawals for admin approval
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getPendingWithdrawalsController = async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const result = await getPendingWithdrawals(parseInt(page), parseInt(limit));
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error fetching pending withdrawals:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching pending withdrawals'
      });
    }
  };
  
  /**
   * Get all withdrawals with filters for admin
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getWithdrawalsController = async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status, 
        user_id, 
        start_date, 
        end_date 
      } = req.query;
      
      const filters = {};
      
      if (status) filters.status = status;
      if (user_id) filters.user_id = user_id;
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      
      const result = await getWithdrawalsAdmin(filters, parseInt(page), parseInt(limit));
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching withdrawals'
      });
    }
  };
  
  /**
   * Process withdrawal approval/rejection action
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const processWithdrawalActionController = async (req, res) => {
    try {
      const { withdrawal_id, action, notes, gateway } = req.body;
      const adminId = req.user.user_id;
      
      if (!withdrawal_id || !action) {
        return res.status(400).json({
          success: false,
          message: 'Withdrawal ID and action are required'
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
          message: 'Notes are required when rejecting a withdrawal'
        });
      }

      if (action === 'approve') {
        // Check if the gateway exists in the table and supports withdrawals
        const PaymentGateway = require('../../models/PaymentGateway');
        const gatewayRecord = await PaymentGateway.findOne({ where: { code: gateway, is_active: true, supports_withdrawal: true } });
        if (!gatewayRecord) {
          return res.status(400).json({
            success: false,
            message: 'Invalid payment gateway. Must be an active gateway that supports withdrawal.'
          });
        }
      }
      
      const result = await processWithdrawalAdminAction(
        adminId,
        withdrawal_id,
        action,
        notes,
        gateway
      );
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error processing withdrawal action:', error);
      res.status(500).json({
        success: false,
        message: 'Server error processing withdrawal action'
      });
    }
  };
  
  module.exports = {
    getPendingWithdrawalsController,
    getWithdrawalsController,
    processWithdrawalActionController
  };