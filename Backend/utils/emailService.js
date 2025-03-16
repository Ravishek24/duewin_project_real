import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter with configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Email templates
const emailTemplates = {
    verification: (token, userName) => ({
        subject: 'Verify Your Email Address',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333;">Welcome to Our Platform, ${userName}!</h2>
                <p>Thank you for registering. Please verify your email address to continue.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL}/verify-email/${token}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email</a>
                </div>
                <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                <p>${process.env.FRONTEND_URL}/verify-email/${token}</p>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
        `
    }),
    
    passwordReset: (token, userName) => ({
        subject: 'Reset Your Password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333;">Password Reset Request</h2>
                <p>Hello ${userName},</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL}/reset-password/${token}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                </div>
                <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                <p>${process.env.FRONTEND_URL}/reset-password/${token}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email or contact support if you have concerns.</p>
            </div>
        `
    }),
    
    welcomeAfterVerification: (userName) => ({
        subject: 'Welcome to Our Platform',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333;">Welcome Aboard, ${userName}!</h2>
                <p>Your email has been successfully verified. Thank you for joining our platform!</p>
                <p>You can now fully access all the features of our platform.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL}/login" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login Now</a>
                </div>
                <p>If you have any questions or need assistance, feel free to contact our support team.</p>
            </div>
        `
    }),
    
    passwordResetConfirmation: (userName) => ({
        subject: 'Your Password Has Been Reset',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333;">Password Reset Successful</h2>
                <p>Hello ${userName},</p>
                <p>Your password has been successfully reset.</p>
                <p>If you did not initiate this change, please contact our support team immediately.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL}/login" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login Now</a>
                </div>
                <p>For security reasons, consider reviewing your account for any unusual activity.</p>
            </div>
        `
    })
};

// Send email function
export const sendEmail = async (to, template, data) => {
    try {
        const emailContent = emailTemplates[template](data.token, data.userName);
        
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: to,
            subject: emailContent.subject,
            html: emailContent.html
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};

export default sendEmail;