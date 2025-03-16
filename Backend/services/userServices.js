import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { Op } from 'sequelize';
import { generateToken, generateJWT } from '../utils/tokenUtils.js';
import { sendEmail } from '../utils/emailService.js';

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
    const { user_name, email, phone_no, password, referral_code } = userData;

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

        // Generate email verification token and expiry
        const verificationToken = generateToken();
        const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        // Create the new user
        const newUser = await User.create({
            user_name: user_name,
            email: email,
            phone_no: phone_no,
            password: hashedPassword,
            referral_code: referral_code, // The referral code used for registration
            referring_code: newReferralCode, // The new referral code for this user
            current_ip: ipAddress, // Captured from the request
            registration_ip: ipAddress, // Captured from the request
            wallet_balance: 0.00, // Initialize wallet with zero balance
            is_email_verified: false,
            email_verification_token: verificationToken,
            email_verification_expiry: verificationExpiry
        });

        // Send verification email
        await sendEmail(email, 'verification', {
            token: verificationToken,
            userName: user_name
        });

        // Generate JWT token
        const token = generateJWT(newUser.user_id, newUser.email);

        return {
            success: true,
            message: 'User created successfully. Please verify your email.',
            user: {
                id: newUser.user_id,
                email: newUser.email,
                phone_no: newUser.phone_no,
                user_name: newUser.user_name,
                referring_code: newUser.referring_code,
                is_email_verified: newUser.is_email_verified
            },
            token: token
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

// Service to login a user
export const loginUser = async (credentials, ipAddress) => {
    const { email, password } = credentials;

    try {
        // Find user
        const user = await User.findOne({ 
            where: { 
                [Op.or]: [
                    { email: email },
                    { phone_no: email } // Allow login with phone number as well
                ]
            } 
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found.'
            };
        }

        // Verify password
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return {
                success: false,
                message: 'Invalid credentials.'
            };
        }

        // Update current IP
        await User.update({ current_ip: ipAddress }, { where: { user_id: user.user_id } });

        // Generate JWT token
        const token = generateJWT(user.user_id, user.email);

        return {
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: user.user_id,
                email: user.email,
                user_name: user.user_name,
                phone_no: user.phone_no,
                is_email_verified: user.is_email_verified,
                wallet_balance: user.wallet_balance
            }
        };
    } catch (error) {
        console.error('Error during login:', error);
        return {
            success: false,
            message: 'Server error during login.'
        };
    }
};

// Service to verify email
export const verifyEmail = async (token) => {
    try {
        // Find user by verification token
        const user = await User.findOne({ 
            where: { 
                email_verification_token: token,
                email_verification_expiry: { [Op.gt]: new Date() } // Token not expired
            } 
        });

        if (!user) {
            return {
                success: false,
                message: 'Invalid or expired verification token.'
            };
        }

        // Update user as verified
        await User.update(
            { 
                is_email_verified: true,
                email_verification_token: null,
                email_verification_expiry: null
            }, 
            { where: { user_id: user.user_id } }
        );

        // Send welcome email
        await sendEmail(user.email, 'welcomeAfterVerification', {
            userName: user.user_name
        });

        return {
            success: true,
            message: 'Email verification successful.',
            user_id: user.user_id
        };
    } catch (error) {
        console.error('Error during email verification:', error);
        return {
            success: false,
            message: 'Server error during verification.'
        };
    }
};

// Service to resend verification email
export const resendVerificationEmail = async (email) => {
    try {
        // Find user by email
        const user = await User.findOne({ where: { email: email } });

        if (!user) {
            return {
                success: false,
                message: 'User not found.'
            };
        }

        if (user.is_email_verified) {
            return {
                success: false,
                message: 'Email is already verified.'
            };
        }

        // Generate new verification token
        const verificationToken = generateToken();
        const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        // Update user with new token
        await User.update(
            { 
                email_verification_token: verificationToken,
                email_verification_expiry: verificationExpiry
            }, 
            { where: { user_id: user.user_id } }
        );

        // Send verification email
        await sendEmail(user.email, 'verification', {
            token: verificationToken,
            userName: user.user_name
        });

        return {
            success: true,
            message: 'Verification email sent successfully.'
        };
    } catch (error) {
        console.error('Error resending verification email:', error);
        return {
            success: false,
            message: 'Server error resending verification email.'
        };
    }
};

// Service to initiate password reset
export const requestPasswordReset = async (email) => {
    try {
        // Find user by email
        const user = await User.findOne({ where: { email: email } });

        if (!user) {
            return {
                success: false,
                message: 'User not found.'
            };
        }

        // Generate password reset token
        const resetToken = generateToken();
        const resetExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour from now

        // Update user with reset token
        await User.update(
            { 
                password_reset_token: resetToken,
                password_reset_expiry: resetExpiry
            }, 
            { where: { user_id: user.user_id } }
        );

        // Send password reset email
        await sendEmail(user.email, 'passwordReset', {
            token: resetToken,
            userName: user.user_name
        });

        return {
            success: true,
            message: 'Password reset instructions sent to your email.'
        };
    } catch (error) {
        console.error('Error requesting password reset:', error);
        return {
            success: false,
            message: 'Server error during password reset request.'
        };
    }
};

// Service to validate password reset token
export const validateResetToken = async (token) => {
    try {
        // Find user by reset token that hasn't expired
        const user = await User.findOne({ 
            where: { 
                password_reset_token: token,
                password_reset_expiry: { [Op.gt]: new Date() } // Token not expired
            } 
        });

        if (!user) {
            return {
                success: false,
                message: 'Invalid or expired reset token.'
            };
        }

        return {
            success: true,
            message: 'Token is valid.',
            user_id: user.user_id
        };
    } catch (error) {
        console.error('Error validating reset token:', error);
        return {
            success: false,
            message: 'Server error validating token.'
        };
    }
};

// Service to reset password
export const resetPassword = async (token, newPassword) => {
    try {
        // Validate the token first
        const tokenValidation = await validateResetToken(token);
        
        if (!tokenValidation.success) {
            return tokenValidation;
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Find the user
        const user = await User.findByPk(tokenValidation.user_id);

        // Update user's password and clear reset token
        await User.update(
            { 
                password: hashedPassword,
                password_reset_token: null,
                password_reset_expiry: null
            }, 
            { where: { user_id: user.user_id } }
        );

        // Send confirmation email
        await sendEmail(user.email, 'passwordResetConfirmation', {
            userName: user.user_name
        });

        return {
            success: true,
            message: 'Password reset successful. You can now login with your new password.'
        };
    } catch (error) {
        console.error('Error resetting password:', error);
        return {
            success: false,
            message: 'Server error resetting password.'
        };
    }
};

// Service to get user profile
export const getUserProfile = async (userId) => {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'email', 'phone_no', 'user_name', 'wallet_balance', 'referring_code', 'is_email_verified', 'created_at']
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found.'
            };
        }

        return {
            success: true,
            user: user
        };
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return {
            success: false,
            message: 'Server error fetching profile.'
        };
    }
};

// Service to update user profile
export const updateUserProfile = async (userId, userData) => {
    try {
        const { user_name, phone_no } = userData;

        // Check if phone number is already taken
        if (phone_no) {
            const existingUser = await User.findOne({
                where: {
                    phone_no: phone_no,
                    user_id: { [Op.ne]: userId }
                }
            });

            if (existingUser) {
                return {
                    success: false,
                    message: 'Phone number is already in use.'
                };
            }
        }

        // Update user
        await User.update(
            { 
                user_name: user_name,
                phone_no: phone_no
            }, 
            { where: { user_id: userId } }
        );

        // Get updated user
        const updatedUser = await User.findByPk(userId, {
            attributes: ['user_id', 'email', 'phone_no', 'user_name', 'wallet_balance', 'referring_code', 'is_email_verified']
        });

        return {
            success: true,
            message: 'Profile updated successfully.',
            user: updatedUser
        };
    } catch (error) {
        console.error('Error updating user profile:', error);
        return {
            success: false,
            message: 'Server error updating profile.'
        };
    }
};

export default {
    createUser,
    loginUser,
    verifyEmail,
    resendVerificationEmail,
    requestPasswordReset,
    validateResetToken,
    resetPassword,
    getUserProfile,
    updateUserProfile
};