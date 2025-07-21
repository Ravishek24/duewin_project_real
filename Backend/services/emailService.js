const nodemailer = require('nodemailer');
const config = require('../config/config');

// Create reusable transporter
// const transporter = nodemailer.createTransport({
//     host: config.email.host,
//     port: config.email.port,
//     secure: config.email.secure,
//     auth: {
//         user: config.email.user,
//         pass: config.email.password
//     }
// });

/**
 * Send verification email for new email address
 * @param {string} email - New email address
 * @param {string} token - Verification token
 * @param {string} username - User's username
 */
const sendVerificationEmail = async (email, token, username) => {
    // Temporarily disabled email verification
    console.log('Email verification temporarily disabled');
    return {
        success: true,
        message: 'Email verification temporarily disabled'
    };
    
    // const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;
    
    // const mailOptions = {
    //     from: `"${config.appName}" <${config.email.user}>`,
    //     to: email,
    //     subject: 'Verify Your New Email Address',
    //     html: `
    //         <h1>Email Verification</h1>
    //         <p>Hello ${username},</p>
    //         <p>You have requested to update your email address. Please click the link below to verify your new email address:</p>
    //         <p><a href="${verificationUrl}">Verify Email Address</a></p>
    //         <p>This link will expire in 24 hours.</p>
    //         <p>If you did not request this change, please ignore this email.</p>
    //         <p>Best regards,<br>${config.appName} Team</p>
    //     `
    // };

    // try {
    //     await transporter.sendMail(mailOptions);
    //     return {
    //         success: true,
    //         message: 'Verification email sent successfully'
    //     };
    // } catch (error) {
    //     console.error('Error sending verification email:', error);
    //     throw new Error('Failed to send verification email');
    // }
};

/**
 * Verify email token
 * @param {string} token - Verification token
 * @returns {Object} - Verification result
 */
const verifyEmailToken = async (token) => {
    // Temporarily disabled email verification
    console.log('Email verification temporarily disabled');
    return {
        success: true,
        message: 'Email verification temporarily disabled'
    };
    
    // try {
    //     const user = await User.findOne({
    //         where: {
    //             email_verification_token: token,
    //             email_verification_token_expiry: { [Op.gt]: new Date() }
    //         }
    //     });

    //     if (!user) {
    //         return {
    //             success: false,
    //             message: 'Invalid or expired verification token'
    //         };
    //     }

    //     // Update user's email verification status
    //     await user.update({
    //         is_email_verified: true,
    //         email_verification_token: null,
    //         email_verification_token_expiry: null
    //     });

    //     return {
    //         success: true,
    //         message: 'Email verified successfully'
    //     };
    // } catch (error) {
    //     console.error('Error verifying email:', error);
    //     return {
    //         success: false,
    //         message: 'Failed to verify email'
    //     };
    // }
};

module.exports = {
    sendVerificationEmail,
    verifyEmailToken
}; 
