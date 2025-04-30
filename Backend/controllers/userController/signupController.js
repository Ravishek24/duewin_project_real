import { createUser } from '../../services/userServices.js';

export const signupController = async (req, res) => {
    const { user_name, email, phone_no, password, referral_code, country_code } = req.body;

    // Validate required fields
    if (!user_name || !email || !phone_no || !password || !referral_code) {
        return res.status(400).json({ 
            success: false, 
            message: 'All fields are required: name, email, phone, password, and referral code.' 
        });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please provide a valid email address.' 
        });
    }

    // Validate phone number format
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone_no)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Phone number must be between 10 and 15 digits.' 
        });
    }

    // Validate password strength
    if (password.length < 6) {
        return res.status(400).json({ 
            success: false, 
            message: 'Password must be at least 6 characters long.' 
        });
    }

    try {
        // Get the client's IP address
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        // Create user with OTP verification
        const result = await createUser(
            { 
                user_name, 
                email, 
                phone_no, 
                password, 
                referral_code,
                country_code: country_code || '91' // Default to India if not provided
            },
            ipAddress
        );
        
        if (result.success) {
            return res.status(201).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during signup.' 
        });
    }
};

export default signupController;