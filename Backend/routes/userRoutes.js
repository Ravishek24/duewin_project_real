import express from 'express';
import { 
    loginController, 
    signupController,
    forgotPasswordController,
    validateTokenController,
    resetPasswordController,
    verifyEmailController,
    resendVerificationController,
    getProfileController,
    updateProfileController
} from '../controllers/userController/index.js';
import { auth, requireEmailVerification } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Auth routes (no middleware)
router.post('/signup', signupController);
router.post('/login', loginController);
router.post('/forgot-password', forgotPasswordController);
router.get('/verify-email/:token', verifyEmailController);
router.post('/resend-verification', resendVerificationController);
router.get('/validate-reset-token/:token', validateTokenController);
router.post('/reset-password', resetPasswordController);

// Protected routes (require authentication)
router.get('/profile', auth, getProfileController);
router.put('/profile', auth, updateProfileController);

// Protected routes that require email verification
router.get('/dashboard', auth, requireEmailVerification, (req, res) => {
    res.status(200).json({
        success: true,
        message: 'This is a protected route that requires email verification.'
    });
});

export default router;