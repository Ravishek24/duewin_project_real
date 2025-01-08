import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'; // Corrected package name
import User from '../../models/User.js';

export const loginController = async (req, res) => { 
    const { email, password } = req.body;

    try {
        
        const user = await User.findOne({ where: { email: email } }); 
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        res.status(200).json({
            message: 'Login successful',
            token: token,
            user: { id: user.id, email: user.email, name: user.name } 
        });
    } catch (error) {
        console.error('Error during login:', error); 
        res.status(500).json({ message: 'Server error.' });
    }
};

export default loginController;
