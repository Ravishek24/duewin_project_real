import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { Op } from 'sequelize';

// Function to generate a unique referral code
const generateReferralCode = async () => {
    let isUnique = false;
    let referralCode;

    while (!isUnique) {
        referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        const existingCode = await User.findOne({ where: { referring_code: referralCode } });
        if (!existingCode) {
            isUnique = true;
        }
    }

    return referralCode;
};

// Service to create a new user
export const createUser = async (userData, ipAddress) => {
    const { phone_no, email, password, referral_code } = userData;

    try {
        // Validate referral code
        if (!referral_code) {
            throw new Error('Referral code is required for registration.');
        }

        const referralValidation = await User.findOne({ where: { referring_code: referral_code } });
        if (!referralValidation) {
            throw new Error('Invalid referral code.');
        }

        // Check if the user already exists by email or phone number
        const userExists = await User.findOne({
            where: {
                [Op.or]: [
                    { email: email },
                    { phone_no: phone_no }
                ]
            }
        });

        if (userExists) {
            throw new Error('User already exists with the provided email or phone number.');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a unique referral code for the new user
        const newReferralCode = await generateReferralCode();

        // Create the new user
        const newUser = await User.create({
            email: email,
            phone_no: phone_no,
            password: hashedPassword,
            referral_code: referral_code, // The referral code used for registration
            referring_code: newReferralCode, // The new referral code for this user
            current_ip: ipAddress, // Captured from the request
            registration_ip: ipAddress // Captured from the request
        });

        return {
            success: true,
            message: 'User created successfully.',
            user: {
                id: newUser.user_id,
                email: newUser.email,
                phone_no: newUser.phone_no,
                referring_code: newUser.referring_code
            }
        };
    } catch (error) {
        console.error('Error creating user:', error); 
        return {
            success: false,
            message: error.message,
            details: error.errors 
        };
    }

};

export default createUser;