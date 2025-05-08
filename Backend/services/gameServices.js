// services/gameService.js
const axios = require('axios');

const API_URL = 'https://api.provider.com'; // Replace with the actual API URL
const API_LOGIN = 'xapitest'; // Replace with your API login
const API_PASSWORD = 'xapitest'; // Replace with your API password

const getGameList = async (currency = 'INR', showSystems = 0, showAdditional = false) => {
  try {
    const response = await axios.post(API_URL, {
      api_login: API_LOGIN,
      api_password: API_PASSWORD,
      method: 'getGameList',
      show_systems: showSystems,
      show_additional: showAdditional,
      currency: currency,
    });

    if (response.data.error === 0) {
      return response.data.response;
    } else {
      throw new Error('Error fetching game list');
    }
  } catch (error) {
    console.error('getGameList Error:', error.message);
    throw error;
  }
};

const getGameDetails = async (gameId) => {
  // Implementation of getGameDetails
};

const getGameBalance = async (gameId) => {
  // Implementation of getGameBalance
};

module.exports = {
  getGameList,
  getGameDetails,
  getGameBalance
};