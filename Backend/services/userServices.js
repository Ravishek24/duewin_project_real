const bcrypt = require('bcrypt');
const User = require('../models/User');
const { Op } = require('sequelize');
const { generateJWT } = require('../utils/tokenUtils');
const referralService = require('./referralService');
const otpService = require('./otpService');

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
const createUser = async (userData, ipAddress) => {
    const { user_name, email, phone_no, password, referral_code, country_code = '91' } = userData;

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

        // Generate and send OTP for phone verification
        const otpResponse = await otpService.createOtpSession(
            phone_no, 
            country_code, 
            user_name, 
            { udf1: email } // Store email in udf1 for reference
        );

        if (!otpResponse.success) {
            throw new Error(`Failed to send OTP: ${otpResponse.message}`);
        }

        // Create user with unverified phone
        const newUser = await User.create({
            user_name: user_name,
            email: email,
            phone_no: phone_no,
            password: hashedPassword,
            referral_code: referral_code, // The referral code used for registration
            referring_code: newReferralCode, // The new referral code for this user
            current_ip: ipAddress,
            registration_ip: ipAddress,
            wallet_balance: 0.00,
            is_phone_verified: false,
            phone_otp_session_id: otpResponse.otpSessionId.toString()
        });

        // Generate JWT token
        const token = generateJWT(newUser.user_id, newUser.email);

        return {
            success: true,
            message: 'Registration initiated. Please verify your phone number with the OTP sent.',
            user: {
                id: newUser.user_id,
                email: newUser.email,
                phone_no: newUser.phone_no,
                user_name: newUser.user_name,
                referring_code: newUser.referring_code,
                is_phone_verified: newUser.is_phone_verified
            },
            token: token,
            otpSessionId: otpResponse.otpSessionId,
            requiresVerification: true
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

// Service to verify phone OTP after registration
const verifyPhoneOtp = async (userId, otpSessionId) => {
    try {
        // Find user
        const user = await User.findByPk(userId);
        
        if (!user) {
            return {
                success: false,
                message: 'User not found.'
            };
        }
        
        // Verify the OTP session ID matches
        if (user.phone_otp_session_id !== otpSessionId.toString()) {
            return {
                success: false,
                message: 'Invalid OTP session for this user.'
            };
        }
        
        // Check OTP session status
        const otpVerificationResult = await otpService.checkOtpSession(otpSessionId);
        
        if (!otpVerificationResult.success) {
            return {
                success: false,
                message: `OTP verification failed: ${otpVerificationResult.message}`
            };
        }
        
        // If OTP is verified, complete the registration
        if (otpVerificationResult.verified) {
            // Update user as verified
            await User.update(
                { 
                    is_phone_verified: true,
                    phone_otp_session_id: null
                }, 
                { where: { user_id: userId } }
            );
            
            // Create referral tree after verification
            await referralService.createReferralTree(userId, user.referral_code);
            
            return {
                success: true,
                message: 'Phone verification successful. Registration complete.',
                user_id: userId,
                is_phone_verified: true
            };
        } else {
            return {
                success: false,
                message: 'OTP has not been verified yet.',
                status: otpVerificationResult.status
            };
        }
    } catch (error) {
        console.error('Error during phone verification:', error);
        return {
            success: false,
            message: 'Server error during verification.'
        };
    }
};

// Service to resend OTP for phone verification
const resendPhoneOtp = async (userId) => {
    try {
        // Find user
        const user = await User.findByPk(userId);
        
        if (!user) {
            return {
                success: false,
                message: 'User not found.'
            };
        }
        
        if (user.is_phone_verified) {
            return {
                success: false,
                message: 'Phone is already verified.'
            };
        }
        
        // Extract country code from phone_no (implementation depends on your storage format)
        // For simplicity, using default '91'
        const country_code = '91';
        
        // Generate and send new OTP
        const otpResponse = await otpService.createOtpSession(
            user.phone_no, 
            country_code, 
            user.user_name, 
            { udf1: user.email }
        );
        
        if (!otpResponse.success) {
            throw new Error(`Failed to send OTP: ${otpResponse.message}`);
        }
        
        // Update user with new OTP session ID
        await User.update(
            { phone_otp_session_id: otpResponse.otpSessionId.toString() }, 
            { where: { user_id: userId } }
        );
        
        return {
            success: true,
            message: 'New OTP sent successfully.',
            otpSessionId: otpResponse.otpSessionId
        };
    } catch (error) {
        console.error('Error resending phone OTP:', error);
        return {
            success: false,
            message: error.message || 'Server error resending OTP.'
        };
    }
};

// Service to login a user
const loginUser = async (credentials, ipAddress) => {
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

        // Check if phone is verified
        if (!user.is_phone_verified) {
            // Generate a new OTP session for verification
            const country_code = '91'; // Default, can be changed based on your needs
            const otpResponse = await otpService.createOtpSession(
                user.phone_no, 
                country_code, 
                user.user_name,
                { udf1: user.email }
            );
            
            if (!otpResponse.success) {
                return {
                    success: false,
                    message: `Login requires phone verification but failed to send OTP: ${otpResponse.message}`
                };
            }
            
            // Update user with new OTP session ID
            await User.update(
                { phone_otp_session_id: otpResponse.otpSessionId.toString() }, 
                { where: { user_id: user.user_id } }
            );
            
            // Generate JWT token
            const token = generateJWT(user.user_id, user.email);
            
            return {
                success: true,
                message: 'Phone verification required to complete login.',
                requiresVerification: true,
                otpSessionId: otpResponse.otpSessionId,
                token: token,
                user: {
                    id: user.user_id,
                    email: user.email,
                    user_name: user.user_name,
                    phone_no: user.phone_no,
                    is_phone_verified: false
                }
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
                is_phone_verified: user.is_phone_verified,
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

// Service to get user profile
const getUserProfile = async (userId) => {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'email', 'phone_no', 'user_name', 'wallet_balance', 'referring_code', 'is_phone_verified', 'created_at']
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
const updateUserProfile = async (userId, userData) => {
    try {
        const { user_name, phone_no, country_code } = userData;

        // If updating phone number, need to verify it
        if (phone_no) {
            // Check if phone number is already taken
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
            
            // Get current user
            const user = await User.findByPk(userId);
            
            // Generate OTP for new phone number
            const otpResponse = await otpService.createOtpSession(
                phone_no, 
                country_code || '91', 
                user.user_name,
                { udf1: user.email, udf2: 'phone_update' }
            );
            
            if (!otpResponse.success) {
                return {
                    success: false,
                    message: `Failed to send OTP: ${otpResponse.message}`
                };
            }
            
            // First update only the OTP session ID
            await User.update(
                { phone_otp_session_id: otpResponse.otpSessionId.toString() }, 
                { where: { user_id: userId } }
            );
            
            return {
                success: true,
                message: 'OTP sent to new phone number. Please verify to complete update.',
                requiresVerification: true,
                otpSessionId: otpResponse.otpSessionId,
                pendingPhoneUpdate: phone_no
            };
        }

        // If only updating name, proceed directly
        if (user_name) {
            await User.update(
                { user_name }, 
                { where: { user_id: userId } }
            );
        }

        // Get updated user
        const updatedUser = await User.findByPk(userId, {
            attributes: ['user_id', 'email', 'phone_no', 'user_name', 'wallet_balance', 'referring_code', 'is_phone_verified']
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

// Service to verify OTP for phone update
const verifyPhoneUpdateOtp = async (userId, otpSessionId, newPhone) => {
    try {
        // Find user
        const user = await User.findByPk(userId);
        
        if (!user) {
            return {
                success: false,
                message: 'User not found.'
            };
        }
        
        // Verify the OTP session ID matches
        if (user.phone_otp_session_id !== otpSessionId.toString()) {
            return {
                success: false,
                message: 'Invalid OTP session for this user.'
            };
        }
        
        // Check OTP session status
        const otpVerificationResult = await otpService.checkOtpSession(otpSessionId);
        
        if (!otpVerificationResult.success) {
            return {
                success: false,
                message: `OTP verification failed: ${otpVerificationResult.message}`
            };
        }
        
        // If OTP is verified, update the phone number
        if (otpVerificationResult.verified) {
            // Update user's phone number
            await User.update(
                { 
                    phone_no: newPhone,
                    is_phone_verified: true,
                    phone_otp_session_id: null
                }, 
                { where: { user_id: userId } }
            );
            
            return {
                success: true,
                message: 'Phone number updated and verified successfully.',
                user_id: userId
            };
        } else {
            return {
                success: false,
                message: 'OTP has not been verified yet.',
                status: otpVerificationResult.status
            };
        }
    } catch (error) {
        console.error('Error during phone update verification:', error);
        return {
            success: false,
            message: 'Server error during verification.'
        };
    }
};

/**
 * Request password reset via SMS (no email)
 * @param {string} email - User's email to identify account
 * @returns {Object} - Result of password reset request
 */
const requestPasswordReset = async (email) => {
    try {
        // Find user by email
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            // Don't reveal if user exists for security reasons
            return {
                success: false,
                message: "If your email is registered, you will receive password reset instructions."
            };
        }
        
        // Generate reset token
        const resetToken = generateJWT(user.user_id, user.email, '1h');
        
        // Update user with reset token
        await User.update(
            {
                reset_token: resetToken,
                reset_token_expiry: new Date(Date.now() + 3600000) // 1 hour from now
            },
            { where: { user_id: user.user_id } }
        );
        
        // In a real implementation, you would send an SMS with OTP
        // For now, we'll just console log the reset token for testing
        console.log('Reset token for user:', resetToken);
        
        return {
            success: true,
            message: "Password reset instructions sent.",
            // We can include the token directly for development 
            // Remove this in production!
            token: resetToken
        };
    } catch (error) {
        console.error('Error requesting password reset:', error);
        return {
            success: false,
            message: "Failed to process password reset request."
        };
    }
};

/**
 * Validate a reset token
 * @param {string} token - Reset token
 * @returns {Object} - Validation result
 */
const validateResetToken = async (token) => {
    try {
        // Hash the provided token
        const tokenHash = generateJWT(null, null, null, token);
        
        // Find user with matching token that hasn't expired
        const user = await User.findOne({
            where: {
                reset_token: tokenHash,
                reset_token_expiry: { [Op.gt]: new Date() }
            }
        });
        
        if (!user) {
            return {
                success: false,
                message: "Invalid or expired token."
            };
        }
        
        return {
            success: true,
            message: "Token validated successfully.",
            userId: user.user_id
        };
    } catch (error) {
        console.error('Error validating reset token:', error);
        return {
            success: false,
            message: "Failed to validate token."
        };
    }
};

/**
 * Reset user password using token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Object} - Password reset result
 */
const resetPassword = async (token, newPassword) => {
    try {
        // Validate token first
        const validation = await validateResetToken(token);
        
        if (!validation.success) {
            return validation; // Return validation error
        }
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update the user's password and clear reset token
        await User.update(
            {
                password: hashedPassword,
                reset_token: null,
                reset_token_expiry: null
            },
            { where: { user_id: validation.userId } }
        );
        
        return {
            success: true,
            message: "Password has been reset successfully."
        };
    } catch (error) {
        console.error('Error resetting password:', error);
        return {
            success: false,
            message: "Failed to reset password."
        };
    }
};

module.exports = {
    createUser,
    verifyPhoneOtp,
    resendPhoneOtp,
    loginUser,
    getUserProfile,
    updateUserProfile,
    verifyPhoneUpdateOtp,
    requestPasswordReset,
    validateResetToken,
    resetPassword
};