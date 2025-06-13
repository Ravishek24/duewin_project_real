const bcrypt = require('bcrypt');
const User = require('../models/User');
const { Op } = require('sequelize');
const { generateJWT } = require('../utils/tokenUtils');
const referralService = require('./referralService');
const otpService = require('./otpService');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { generateTokens, verifyAccessToken } = require('./tokenService');
const UserSession = require('../models/UserSession');
const crypto = require('crypto');

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

// Function to generate a unique username
const generateUniqueUsername = async () => {
    let isUnique = false;
    let username;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
        // Generate a random number between 1000 and 9999
        const randomNum = Math.floor(Math.random() * 9000) + 1000;
        username = `user${randomNum}`;

        const existingUser = await User.findOne({ where: { user_name: username } });
        if (!existingUser) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        throw new Error('Failed to generate unique username after multiple attempts');
    }

    return username;
};

// Service to create a new user
const createUser = async (userData, ipAddress) => {
    const { phone_no, password, referral_code, email, country_code = '91' } = userData;

    try {
        // Validate required fields
        if (!phone_no || !password) {
            throw new Error('Phone number and password are required.');
        }

        // Validate phone number format
        if (!/^\d{10,15}$/.test(phone_no)) {
            throw new Error('Invalid phone number format. Must be 10-15 digits.');
        }

        // Validate password length
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
        }

        // Validate email if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Invalid email format.');
        }

        // Check if phone number already exists
        const existingPhone = await User.findOne({ where: { phone_no } });
        if (existingPhone) {
            throw new Error('Phone number is already registered.');
        }

        // Check if email already exists (if provided)
        if (email) {
            const existingEmail = await User.findOne({ where: { email } });
            if (existingEmail) {
                throw new Error('Email is already registered.');
            }
        }

        // Validate referral code if provided
        if (referral_code) {
            const referralValidation = await User.findOne({ where: { referring_code: referral_code } });
            if (!referralValidation) {
                throw new Error('Invalid referral code.');
            }
        }

        // Generate unique username
        const username = await generateUniqueUsername();

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a unique referral code for the new user
        const newReferralCode = await generateReferralCode();

        // Create user
        const newUser = await User.create({
            user_name: username,
            email: email || null,
            phone_no: phone_no,
            password: hashedPassword,
            referral_code: referral_code || null,
            referring_code: newReferralCode,
            current_ip: ipAddress,
            registration_ip: ipAddress,
            wallet_balance: 0.00,
            is_phone_verified: true
        });

        // Generate JWT token
        const token = generateJWT(newUser.user_id, newUser.email);

        // Create referral tree if referral code was used
        if (referral_code) {
            await referralService.createReferralTree(newUser.user_id, newUser.referral_code);
        }

        return {
            success: true,
            message: 'Registration successful.',
            user: {
                id: newUser.user_id,
                username: newUser.user_name,
                email: newUser.email,
                phone_no: newUser.phone_no,
                referring_code: newUser.referring_code,
                is_phone_verified: newUser.is_phone_verified
            },
            token: token
        };
    } catch (error) {
        console.error('Error creating user:', error);
        return {
            success: false,
            message: error.message
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

/**
* Login user
* @param {string} email - User email
* @param {string} password - User password
* @param {string} ipAddress - User IP address
* @returns {Object} - Login result
*/
const login = async (email, password, ipAddress) => {
    try {
        // Find user by email or phone
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { email: email },
                    { phone_no: email }
                ]
            }
        });

        // Generic error for both invalid user and password
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return {
                success: false,
                message: 'Invalid credentials'
            };
        }

        // Check if user is active - use generic message
        if (!user.is_active) {
            return {
                success: false,
                message: 'Invalid credentials'
            };
        }

        // Check for existing session from different IP
        const existingSession = await UserSession.findOne({
            where: {
                userId: user.user_id,
                isValid: true,
                expiresAt: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (existingSession && existingSession.ipAddress !== ipAddress) {
            return {
                success: false,
                message: 'Invalid credentials'
            };
        }

        // Generate tokens with IP
        const { accessToken, refreshToken } = await generateTokens(user, ipAddress);

        // Update user's current IP
        await User.update(
            { current_ip: ipAddress },
            { where: { user_id: user.user_id } }
        );

        return {
            success: true,
            message: 'Login successful',
            user: {
                id: user.user_id,
                username: user.user_name,
                email: user.email,
                phone_no: user.phone_no,
                is_phone_verified: user.is_phone_verified,
                wallet_balance: user.wallet_balance
            },
            accessToken,
            refreshToken
        };
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            message: 'Invalid credentials'
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
        const { user_name, phone_no, email, country_code } = userData;

        // If updating email, need to verify it
        if (email) {
            // Check if email is already taken
            const existingUser = await User.findOne({
                where: {
                    email: email,
                    user_id: { [Op.ne]: userId }
                }
            });

            if (existingUser) {
                return {
                    success: false,
                    message: 'Email is already in use.'
                };
            }

            // Get current user
            const user = await User.findByPk(userId);
            
            // Generate verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Update user with new email and verification token
            await User.update(
                {
                    email: email,
                    email_verification_token: verificationToken,
                    email_verification_token_expiry: tokenExpiry,
                    is_email_verified: false
                },
                { where: { user_id: userId } }
            );

            // Send verification email
            try {
                await sendVerificationEmail(email, verificationToken, user.user_name);
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
                // Don't fail the update if email sending fails
            }

            return {
                success: true,
                message: 'Email updated. Please check your email to verify the new address.',
                requiresVerification: true,
                verificationToken: verificationToken
            };
        }

        // If updating phone number, just update directly (no OTP)
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

            await User.update(
                { phone_no },
                { where: { user_id: userId } }
            );
        }

        // If only updating name, proceed directly
        if (user_name) {
            // Check if username is already taken
            const existingUser = await User.findOne({
                where: {
                    user_name: user_name,
                    user_id: { [Op.ne]: userId }
                }
            });

            if (existingUser) {
                return {
                    success: false,
                    message: 'Username is already taken.'
                };
            }

            await User.update(
                { user_name }, 
                { where: { user_id: userId } }
            );
        }

        // Get updated user
        const updatedUser = await User.findByPk(userId, {
            attributes: ['user_id', 'email', 'phone_no', 'user_name', 'wallet_balance', 'referring_code', 'is_phone_verified', 'is_email_verified']
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
        const user = await User.findOne({ where: { email } });
        
        // Always return same message regardless of user existence
        if (!user) {
            return {
                success: true,
                message: "If your email is registered, you will receive password reset instructions."
            };
        }
        
        const resetToken = generateJWT(user.user_id, user.email, '1h');
        
        await User.update(
            {
                reset_token: resetToken,
                reset_token_expiry: new Date(Date.now() + 3600000)
            },
            { where: { user_id: user.user_id } }
        );
        
        // Remove token logging in production
        if (process.env.NODE_ENV === 'development') {
            console.log('Reset token generated for testing');
        }
        
        return {
            success: true,
            message: "If your email is registered, you will receive password reset instructions."
        };
    } catch (error) {
        console.error('Error requesting password reset:', error);
        return {
            success: true,
            message: "If your email is registered, you will receive password reset instructions."
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
    login,
    getUserProfile,
    updateUserProfile,
    verifyPhoneUpdateOtp,
    requestPasswordReset,
    validateResetToken,
    resetPassword
};