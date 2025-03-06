import express from 'express';
import { signupController } from '../controllers/userController/signupController.js';
import { loginController } from '../controllers/userController/loginController.js'; // Import login controller

export const router = express.Router();

// Register routes
router.post('/login', loginController); 
router.post('/signup', signupController);

export default router;