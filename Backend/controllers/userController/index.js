const loginController = require('./loginController');
const signupController = require('./signupController');
const { validateTokenController, resetPasswordController } = require('./resetPasswordController');
const { verifyEmailController, resendVerificationController } = require('./emailVerificationController');
const { getProfileController, updateProfileController } = require('./profileController');
const forgotPasswordController = require('./forgotPasswordController');

module.exports = {
    loginController,
    signupController,
    validateTokenController,
    resetPasswordController,
    verifyEmailController,
    resendVerificationController,
    getProfileController,
    updateProfileController,
    forgotPasswordController
};