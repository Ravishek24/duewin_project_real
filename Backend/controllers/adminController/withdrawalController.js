// controllers/adminController/withdrawalController.js
import {
    getPendingWithdrawals,
    getWithdrawalsAdmin,
    processWithdrawalAdminAction
  } from '../../services/paymentService.js';
  
  /**
   * Get pending withdrawals for admin approval
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  export const getPendingWithdrawalsController = async (req, res) => {
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
  export const getWithdrawalsController = async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        admin_status, 
        user_id, 
        start_date, 
        end_date 
      } = req.query;
      
      const filters = {};
      
      if (admin_status) filters.admin_status = admin_status;
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
  export const processWithdrawalActionController = async (req, res) => {
    try {
      const { withdrawal_id, action, notes } = req.body;
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
      
      const result = await processWithdrawalAdminAction(
        adminId,
        withdrawal_id,
        action,
        notes
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
  
  export default {
    getPendingWithdrawalsController,
    getWithdrawalsController,
    processWithdrawalActionController
  };