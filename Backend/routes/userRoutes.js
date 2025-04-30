import express from 'express';
import { 
    loginController, 
    signupController,
    forgotPasswordController,
    validateTokenController,
    resetPasswordController,
    getProfileController,
    updateProfileController
} from '../controllers/userController/index.js';
import { auth, requirePhoneVerification } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Auth routes (no middleware)
router.post('/signup', signupController);
router.post('/login', loginController);
router.post('/forgot-password', forgotPasswordController);
router.post('/reset-password', resetPasswordController);
router.get('/validate-reset-token/:token', validateTokenController);

// Protected routes (require authentication)
router.get('/profile', auth, getProfileController);
router.put('/profile', auth, updateProfileController);

// Protected routes that require phone verification
router.get('/dashboard', auth, requirePhoneVerification, (req, res) => {
    res.status(200).json({
        success: true,
        message: 'This is a protected route that requires phone verification.'
    });
});

export default router;