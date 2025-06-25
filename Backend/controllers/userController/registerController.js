const { User } = require('../../models');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { autoRecordReferral } = require('../../services/referralService'); // Fixed path
const referralCodeGenerator = require('../../utils/referralCodeGenerator');
const registrationQueue = require('../../queues/registrationQueue');

// Fallback function to generate referral code if utility is not available
const generateReferringCode = () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Inline security headers function
const setSecurityHeaders = (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
};


// Add this function in registerController.js after imports

const applyRegistrationBonus = async (userId, transaction) => {
    const REGISTRATION_BONUS = 25.00;

    try {
        console.log(`🎁 Applying registration bonus for user ${userId}`);

        // Get models dynamically
        const { getModels } = require('../../models');
        const models = await getModels();

        // Credit registration bonus to wallet
        await models.User.increment('wallet_balance', {
            by: REGISTRATION_BONUS,
            where: { user_id: userId },
            transaction
        });

        // Create transaction record with house games restriction metadata
        await models.Transaction.create({
            user_id: userId,
            type: 'registration_bonus',
            amount: REGISTRATION_BONUS,
            status: 'completed',
            description: 'Welcome bonus for new registration',
            reference_id: `reg_bonus_${userId}_${Date.now()}`,
            metadata: {
                bonus_type: 'registration',
                usage_restriction: 'house_games_only',
                allowed_games: ['wingo', '5d', 'k3', 'trx_wix'],
                restriction_note: 'This bonus can only be used for house games (lottery games)'
            }
        }, { transaction });

        console.log(`✅ Registration bonus of ${REGISTRATION_BONUS} credited to user ${userId}`);
        return { success: true, amount: REGISTRATION_BONUS };
    } catch (error) {
        console.error('❌ Error applying registration bonus:', error);
        throw error;
    }
};

// Call this function in registerController after user creation:
// await applyRegistrationBonus(user.user_id, transaction);
const registerController = async (req, res) => {
    try {
        // Get models dynamically
        const { getModels } = require('../../models');
        const models = await getModels();
        const User = models.User;

        // Check if User model is properly initialized
        if (!User || typeof User.findOne !== 'function') {
            console.error('User model not properly initialized');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error. Please try again later.'
            });
        }

        const { phone_no, password, referred_by, email, user_name } = req.body;

        // Validate required fields
        if (!phone_no || !password || !referred_by) {
            return res.status(400).json({
                success: false,
                message: 'Phone number, password, and referral code are required'
            });
        }

        // Start transaction for user creation only
        const transaction = await User.sequelize.transaction();

        try {
            // Check if user already exists (optimized query)
            const existingUser = await User.findOne({
                where: {
                    [Op.or]: [
                        { phone_no },
                        ...(email ? [{ email }] : []),
                        ...(user_name ? [{ user_name }] : [])
                    ]
                },
                transaction,
                attributes: ['user_id'] // Only fetch what we need
            });

            if (existingUser) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'User already exists with this phone number, email, or username'
                });
            }

            // Generate unique referring code (optimized)
            const referring_code = await referralCodeGenerator.generateUniqueCode(User, transaction);

            // Generate username if not provided
            const auto_username = user_name || `user_${Date.now().toString().slice(-8)}`;

            // Create new user
            const user = await User.create({
                phone_no,
                email: email || null,
                user_name: auto_username,
                password,
                referring_code,
                referral_code: referred_by,
                is_phone_verified: true,
                wallet_balance: 0,
                last_login_at: new Date(),
                last_login_ip: req.ip || req.connection.remoteAddress
            }, { transaction });

            // Commit transaction immediately after user creation
            await transaction.commit();

            // Add background jobs with proper configuration
            const registrationQueue = require('../../queues/registrationQueue');
            
            // Job 1: Apply bonus (higher priority)
            const bonusJobId = `bonus-${user.user_id}`;
            await registrationQueue.add('applyBonus', {
                type: 'applyBonus',
                data: { userId: user.user_id }
            }, {
                jobId: bonusJobId,
                priority: 10,
                removeOnComplete: 5,
                removeOnFail: 10,
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 }
            });
            
            // Job 2: Record referral (waits for bonus job)
            if (referred_by) {
                await registrationQueue.add('recordReferral', {
                    type: 'recordReferral',
                    data: { userId: user.user_id, referredBy: referred_by }
                }, {
                    waitFor: [bonusJobId],
                    priority: 5,
                    delay: 2000, // Delay to ensure bonus is processed first
                    removeOnComplete: 5,
                    removeOnFail: 10,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 2000 }
                });
            }

            // Generate tokens
            const accessToken = generateToken(user);
            const refreshToken = generateRefreshToken(user);

            // Set security headers
            setSecurityHeaders(res);

            // Respond immediately
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: {
                        id: user.user_id,
                        phone_no: user.phone_no,
                        email: user.email,
                        user_name: user.user_name,
                        referring_code: user.referring_code,
                        is_phone_verified: user.is_phone_verified,
                        wallet_balance: user.wallet_balance,
                        profile_picture_id: 1, // Default profile picture
                    },
                    tokens: {
                        accessToken,
                        refreshToken
                    }
                }
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Registration error:', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(e => e.message)
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error during registration',
            error: error.message
        });
    }
};



// REMOVED PROBLEMATIC CODE:
// This was causing the error:
// if (referralCode) {
//     const referralResult = await autoRecordReferral(newUser.user_id, referralCode);
//     console.log('Referral auto-recorded:', referralResult);
// }

module.exports = registerController;