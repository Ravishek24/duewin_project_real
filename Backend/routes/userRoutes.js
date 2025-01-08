import express from 'express';
import { signupController } from '../controllers/userController/signupController.js';
import { loginController } from '../controllers/userController/loginController.js'; // Import login controller

export const router = express.Router(); // Fixed capitalization

// Register routes
router.post('/login', loginController); // Fixed typo
router.post('/signup', signupController);

export default router;