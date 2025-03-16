import { loginUser } from '../../services/userServices.js';

export const loginController = async (req, res) => { 
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email/phone and password are required.' 
        });
    }

    try {
        // Get the client's IP address
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        // Call login service
        const result = await loginUser({ email, password }, ipAddress);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(401).json(result);
        }
    } catch (error) {
        console.error('Error during login:', error); 
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login.' 
        });
    }
};

export default loginController;