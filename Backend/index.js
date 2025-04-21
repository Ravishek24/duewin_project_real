// Backend/index.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import { sequelize, connectDB } from './config/db.js';
import allRoutes from './routes/index.js';
import internalGameRoutes from './routes/internalGameRoutes.js';
import { initializeWebSocket } from './services/websocketService.js';
import './config/redisConfig.js'; // Import to initialize Redis connection

// Load environment variables early
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.SERVER_PORT || 8000;

// Create HTTP server (needed for Socket.io)
const server = http.createServer(app);

// Initialize WebSocket server
initializeWebSocket(server);

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
app.use('/api/games', internalGameRoutes); // Add the internal game routes

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
server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});

export default app;