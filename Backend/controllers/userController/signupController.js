import { createUser } from '../../services/userServices.js';

export const signupController = async (req, res) => {
    const { user_name, email, phone_no, password, referral_code } = req.body;

    try {
        // Get the client's IP address
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        // Call the service to create the user
        const result = await createUser(
            { user_name, email, phone_no, password, referral_code },
            ipAddress
        );

        if (result.success) {
            return res.status(201).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error during signup:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export default signupController;
