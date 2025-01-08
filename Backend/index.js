import express from 'express';
import dotenv from 'dotenv';
import { sequelize, connectDB } from './config/db.js'; // Assuming `sequelize` and `connectDB` are correctly implemented
import { userRoutes } from './routes/index.js'; // Import routes
dotenv.config(); // Load environment variables early

// Connect to the database
connectDB();

const app = express();
const PORT = process.env.SERVER_PORT || 8000; // Fallback to 8000 if SERVER_PORT is not set

// Middleware
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded requests



// Example for user routes
app.use('/users', userRoutes);

// Server Start
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
