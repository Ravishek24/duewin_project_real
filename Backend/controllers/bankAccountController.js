import { 
    getBankAccounts, 
    addBankAccount, 
    updateBankAccount, 
    deleteBankAccount 
} from '../services/bankAccountServices.js';

// Controller to get user's bank accounts
export const getBankAccountsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await getBankAccounts(userId);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }
    } catch (error) {
        console.error('Error fetching bank accounts:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching bank accounts.' 
        });
    }
};

// Controller to add a bank account
export const addBankAccountController = async (req, res) => {
    const { 
        account_holder_name, 
        account_number, 
        bank_name, 
        ifsc_code, 
        branch_name,
        is_primary 
    } = req.body;

    // Validate required fields
    if (!account_holder_name || !account_number || !bank_name || !ifsc_code) {
        return res.status(400).json({
            success: false,
            message: 'Please provide all required fields: account holder name, account number, bank name, and IFSC code.'
        });
    }

    try {
        const userId = req.user.user_id;
        const result = await addBankAccount(userId, {
            account_holder_name,
            account_number,
            bank_name,
            ifsc_code,
            branch_name,
            is_primary
        });
        
        if (result.success) {
            return res.status(201).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error adding bank account:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error adding bank account.' 
        });
    }
};

// Controller to update a bank account
export const updateBankAccountController = async (req, res) => {
    const accountId = req.params.id;
    const { 
        account_holder_name, 
        bank_name, 
        ifsc_code, 
        branch_name,
        is_primary 
    } = req.body;

    try {
        const userId = req.user.user_id;
        const result = await updateBankAccount(userId, accountId, {
            account_holder_name,
            bank_name,
            ifsc_code,
            branch_name,
            is_primary
        });
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error updating bank account:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error updating bank account.' 
        });
    }
};

// Controller to delete a bank account
export const deleteBankAccountController = async (req, res) => {
    const accountId = req.params.id;

    try {
        const userId = req.user.user_id;
        const result = await deleteBankAccount(userId, accountId);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error deleting bank account:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error deleting bank account.' 
        });
    }
};

export default {
    getBankAccountsController,
    addBankAccountController,
    updateBankAccountController,
    deleteBankAccountController
};