// index.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { sequelize, connectDB } from './config/db.js';
import allRoutes from './routes/index.js'; // Import the combined routes from routes/index.js

// Load environment variables early
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.SERVER_PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to the database
connectDB();

app.get('/', (req, res) => {
    res.send('Server is running successfully!');
});

// API Routes
app.use('/api', allRoutes); // Use the combined routes with /api prefix

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Server Start
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});

export default app;