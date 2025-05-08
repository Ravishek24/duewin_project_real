// controllers/gameController.js
const { getGameList } = require('../services/gameServices');

const fetchGameList = async (req, res) => {
  try {
    const { currency } = req.query; // Get currency from query parameters
    const games = await getGameList(currency);
    res.status(200).json(games);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch game list' });
  }
};

module.exports = {
  fetchGameList
};

