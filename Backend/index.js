import express from 'express';
import dotenv from 'dotenv';
import { sequelize, connectDB } from './config/db.js'; // Assuming `sequelize` and `connectDB` are correctly implemented
import { userRoutes } from './routes/index.js'; // Import routes
import gameRoutes from './routes/gameRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
dotenv.config(); // Load environment variables early

// Connect to the database
connectDB();

const app = express();
const PORT = process.env.SERVER_PORT || 8000;

// Middleware
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));



// Example for user routes
app.use('/users', userRoutes);
app.use('/api', gameRoutes);

// Server Start
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
