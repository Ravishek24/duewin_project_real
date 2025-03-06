// routes/gameRoutes.js
import express from 'express';
import { fetchGameList } from '../controllers/gameController.js';

const router = express.Router();

router.get('/games', fetchGameList);

export default router;
