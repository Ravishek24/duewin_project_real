// routes/gameRoutes.js
const express = require('express');
const { fetchGameList } = require('../controllers/gameController');

const router = express.Router();

router.get('/games', fetchGameList);

module.exports = router;
