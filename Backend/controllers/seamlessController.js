// controllers/seamlessController.js
const { validateSeamlessSignature } = require('../utils/seamlessUtils');
const {
  getGameList,
  getGameUrl,
  createPlayer,
  processBalanceRequest,
  processDebitRequest,
  processCreditRequest,
  processRollbackRequest,
  addFreeRounds,
  removeFreeRounds
} = require('../services/seamlessWalletService');
const seamlessService = require('../services/seamlessService');


// Add this debug function to your seamlessController.js

/**
 * Enhanced debug controller for seamless integration testing
 */
const debugSeamlessIntegration = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.user_id;
    
    console.log('🔍 === SEAMLESS DEBUG SESSION START ===');
    console.log('🔍 User ID:', userId);
    console.log('🔍 Game ID:', gameId);
    console.log('🔍 Environment:', process.env.NODE_ENV);
    
    // Step 1: Check configuration
    console.log('📋 Step 1: Checking seamless configuration...');
    const seamlessConfig = require('../config/seamlessConfig');
    const configCheck = {
      api_login: !!seamlessConfig.api_login,
      api_password: !!seamlessConfig.api_password,
      salt_key: !!seamlessConfig.salt_key,
      api_url: seamlessConfig.api_url.production,
      home_url: seamlessConfig.home_url,
      cashier_url: seamlessConfig.cashier_url,
      callback_url: seamlessConfig.callback_url
    };
    console.log('📋 Config check:', configCheck);
    
    // Step 2: Check user exists
    console.log('👤 Step 2: Checking user...');
    const User = require('../models/User');
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        debug: { step: 'user_check', userId }
      });
    }
    console.log('👤 User found:', { id: user.user_id, name: user.user_name });
    
    // Step 3: Generate credentials
    const { generatePlayerCredentials } = require('../services/seamlessWalletService');
    const credentials = generatePlayerCredentials(user);
    console.log('🔑 Step 3: Generated credentials:', {
      username: credentials.username,
      nickname: credentials.nickname
      // Don't log password for security
    });
    
    // Step 4: Test provider connectivity
    console.log('🌐 Step 4: Testing provider connectivity...');
    const axios = require('axios');
    
    try {
      // Test with getGameList first
      const testRequest = {
        api_login: seamlessConfig.api_login,
        api_password: seamlessConfig.api_password,
        method: 'getGameList',
        show_systems: 0,
        currency: 'EUR'
      };
      
      console.log('🌐 Testing provider with getGameList...');
      const testResponse = await axios.post(
        seamlessConfig.api_url.production,
        testRequest,
        { timeout: 10000 }
      );
      
      console.log('🌐 Provider connectivity test result:', {
        status: testResponse.status,
        error: testResponse.data.error,
        hasGames: Array.isArray(testResponse.data.response) && testResponse.data.response.length > 0
      });
      
      if (testResponse.data.error !== 0) {
        return res.status(400).json({
          success: false,
          message: 'Provider connectivity failed',
          debug: {
            step: 'provider_connectivity',
            error: testResponse.data.error,
            message: testResponse.data.message
          }
        });
      }
      
    } catch (connectError) {
      console.error('🌐 Provider connectivity failed:', connectError.message);
      return res.status(500).json({
        success: false,
        message: 'Cannot connect to game provider',
        debug: {
          step: 'provider_connectivity',
          error: connectError.message,
          code: connectError.code
        }
      });
    }
    
    // Step 5: Test player exists
    console.log('🔍 Step 5: Testing playerExists...');
    const playerExistsRequest = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'playerExists',
      user_username: credentials.username,
      currency: 'EUR'
    };
    
    const playerExistsResponse = await axios.post(
      seamlessConfig.api_url.production,
      playerExistsRequest
    );
    
    console.log('🔍 PlayerExists result:', {
      error: playerExistsResponse.data.error,
      exists: !!playerExistsResponse.data.response,
      response: playerExistsResponse.data.response
    });
    
    let playerExists = playerExistsResponse.data.error === 0 && !!playerExistsResponse.data.response;
    
    // Step 6: Create player if doesn't exist
    if (!playerExists) {
      console.log('👤 Step 6: Creating player...');
      const createPlayerRequest = {
        api_login: seamlessConfig.api_login,
        api_password: seamlessConfig.api_password,
        method: 'createPlayer',
        user_username: credentials.username,
        user_password: credentials.password,
        user_nickname: credentials.nickname,
        currency: 'EUR'
      };
      
      const createPlayerResponse = await axios.post(
        seamlessConfig.api_url.production,
        createPlayerRequest
      );
      
      console.log('👤 CreatePlayer result:', {
        error: createPlayerResponse.data.error,
        message: createPlayerResponse.data.message,
        response: createPlayerResponse.data.response
      });
      
      if (createPlayerResponse.data.error !== 0) {
        return res.status(400).json({
          success: false,
          message: 'Failed to create player',
          debug: {
            step: 'create_player',
            error: createPlayerResponse.data.error,
            message: createPlayerResponse.data.message
          }
        });
      }
    }
    
    // Step 7: Test getGame
    console.log('🎮 Step 7: Testing getGame...');
    const getGameRequest = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGame',
      lang: 'en',
      user_username: credentials.username,
      user_password: credentials.password,
      gameid: gameId,
      homeurl: seamlessConfig.home_url,
      cashierurl: seamlessConfig.cashier_url,
      play_for_fun: 0,
      currency: 'EUR'
    };
    
    const getGameResponse = await axios.post(
      seamlessConfig.api_url.production,
      getGameRequest
    );
    
    console.log('🎮 GetGame result:', {
      error: getGameResponse.data.error,
      message: getGameResponse.data.message,
      hasUrl: !!(getGameResponse.data.url || getGameResponse.data.response),
      sessionId: getGameResponse.data.sessionid,
      gameSessionId: getGameResponse.data.gamesession_id
    });
    
    console.log('🔍 === SEAMLESS DEBUG SESSION END ===');
    
    // Return comprehensive debug info
    return res.status(200).json({
      success: getGameResponse.data.error === 0,
      message: getGameResponse.data.error === 0 ? 'Debug completed successfully' : 'Debug found issues',
      debug: {
        configuration: configCheck,
        user: { id: user.user_id, name: user.user_name },
        credentials: { username: credentials.username, nickname: credentials.nickname },
        playerExists: playerExists,
        gameResponse: {
          error: getGameResponse.data.error,
          message: getGameResponse.data.message,
          hasUrl: !!(getGameResponse.data.url || getGameResponse.data.response),
          sessionId: getGameResponse.data.sessionid
        }
      },
      gameUrl: getGameResponse.data.url || getGameResponse.data.response
    });
    
  } catch (error) {
    console.error('🔍 Debug error:', error);
    return res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error.message,
      stack: error.stack
    });
  }
};


/**
 * Controller to fetch list of available games
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGamesController = async (req, res) => {
  try {
    const { currency } = req.query;
    const result = await getGameList(currency);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in getGamesController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching games list'
    });
  }
};

/**
 * Controller to launch a game and get the game URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const launchGameController = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { language } = req.query;
    const userId = req.user.user_id;
    
    console.log('=== GAME LAUNCH DEBUG ===');
    console.log('User ID:', userId);
    console.log('Game ID:', gameId);
    console.log('Language:', language);
    
    const result = await getGameUrl(userId, gameId, language);
    
    console.log('Game URL result:', {
      success: result.success,
      hasGameUrl: !!result.gameUrl,
      message: result.message
    });
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in launchGameController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error launching game'
    });
  }
};

/**
 * Controller to serve a game directly in an iframe to help bypass Cloudflare restrictions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const serveGameInIframeController = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { language } = req.query;
    const userId = req.user.user_id;
    
    const result = await getGameUrl(userId, gameId, language);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // Generate HTML with the game in an iframe
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Game - ${gameId}</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
          .warning-message {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background-color: #ffeb3b;
            color: #333;
            text-align: center;
            padding: 10px;
            z-index: 1000;
            font-family: Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        ${result.warningMessage ? `<div class="warning-message">${result.warningMessage}</div>` : ''}
        <iframe src="${result.gameUrl}" allow="autoplay; fullscreen" allowfullscreen></iframe>
      </body>
      </html>
    `;
    
    // Send the HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error in serveGameInIframeController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error launching game in iframe'
    });
  }
};

/**
 * Controller to redirect directly to the game URL (alternative approach)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const redirectToGameController = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { language } = req.query;
    const userId = req.user.user_id;
    
    const result = await getGameUrl(userId, gameId, language);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // Redirect directly to the game URL
    res.redirect(result.gameUrl);
  } catch (error) {
    console.error('Error in redirectToGameController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error redirecting to game'
    });
  }
};

/**
 * Controller to handle wallet balance requests from the game provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
/**
 * CRITICAL: Individual callback handlers for backward compatibility
 * Some providers might call specific endpoints
 */
const balanceCallbackController = async (req, res) => {
  try {
    console.log('💰 Balance callback hit directly');
    
    // Validate signature
    const isValidSignature = validateSeamlessSignature(req.query);
    if (!isValidSignature) {
      return res.status(200).json({
        status: '403',
        msg: 'Invalid signature'
      });
    }

    const result = await processBalanceRequest(req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error in balance callback:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};

/**
 * Controller to handle debit (bet) requests from the game provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const debitCallbackController = async (req, res) => {
  try {
    console.log('📉 Debit callback hit directly');
    
    // Validate signature
    const isValidSignature = validateSeamlessSignature(req.query);
    if (!isValidSignature) {
      return res.status(200).json({
        status: '403',
        msg: 'Invalid signature'
      });
    }

    const result = await processDebitRequest(req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error in debit callback:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};

/**
 * Controller to handle credit (win) requests from the game provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const creditCallbackController = async (req, res) => {
  try {
    console.log('📈 Credit callback hit directly');
    
    // Validate signature
    const isValidSignature = validateSeamlessSignature(req.query);
    if (!isValidSignature) {
      return res.status(200).json({
        status: '403',
        msg: 'Invalid signature'
      });
    }

    const result = await processCreditRequest(req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error in credit callback:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};


/**
 * Controller to handle rollback requests from the game provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rollbackCallbackController = async (req, res) => {
  try {
    console.log('🔄 Rollback callback hit directly');
    
    // Validate signature
    const isValidSignature = validateSeamlessSignature(req.query);
    if (!isValidSignature) {
      return res.status(200).json({
        status: '403',
        msg: 'Invalid signature'
      });
    }

    const result = await processRollbackRequest(req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error in rollback callback:', error);
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};

/**
 * Health check endpoint for the seamless integration
 */
const healthCheckController = async (req, res) => {
  try {
    const seamlessConfig = require('../config/seamlessConfig');
    
    return res.status(200).json({
      status: 'ok',
      service: 'seamless-wallet',
      timestamp: new Date().toISOString(),
      config: {
        api_login: !!seamlessConfig.api_login,
        api_password: !!seamlessConfig.api_password,
        salt_key: !!seamlessConfig.salt_key,
        callback_url: seamlessConfig.callback_url
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};


/**
 * Controller to add free rounds to players (admin use)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addFreeRoundsController = async (req, res) => {
  try {
    const {
      title,
      playerIds,
      gameIds,
      available,
      validTo,
      validFrom,
      betLevel
    } = req.body;
    
    // Validate required fields
    if (!title || !playerIds || !gameIds || !available || !validTo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const result = await addFreeRounds(
      title,
      playerIds,
      gameIds,
      available,
      validTo,
      validFrom,
      betLevel
    );
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in addFreeRoundsController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding free rounds'
    });
  }
};

/**
 * Controller to remove free rounds from players (admin use)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removeFreeRoundsController = async (req, res) => {
  try {
    const {
      title,
      playerIds,
      gameIds
    } = req.body;
    
    // Validate required fields
    if (!title || !playerIds || !gameIds) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const result = await removeFreeRounds(
      title,
      playerIds,
      gameIds
    );
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in removeFreeRoundsController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error removing free rounds'
    });
  }
};

/**
 * Unified callback controller to handle all transaction types
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
/**
 * FIXED: Unified callback controller with proper user resolution
 */
const unifiedCallbackController = async (req, res) => {
  try {
    console.log('=== UNIFIED CALLBACK REQUEST ===');
    console.log('Request method:', req.method);
    console.log('Request path:', req.path);
    console.log('Request query:', req.query);
    console.log('Request headers:', req.headers);

    const { action, remote_id, username } = req.query;
    console.log('Action type:', action);
    console.log('Remote ID:', remote_id);
    console.log('Username:', username);

    // CRITICAL FIX: Validate the request signature first
    const isValidSignature = validateSeamlessSignature(req.query);
    if (!isValidSignature) {
      console.error('Invalid signature in callback request');
      return res.status(200).json({
        status: '403',
        msg: 'Invalid signature'
      });
    }

    let result;

    // Route to appropriate handler based on action type
    switch (action) {
      case 'balance':
        console.log('Processing balance request');
        result = await processBalanceRequest(req.query);
        break;
      case 'debit':
        console.log('Processing debit request');
        result = await processDebitRequest(req.query);
        break;
      case 'credit':
        console.log('Processing credit request');
        result = await processCreditRequest(req.query);
        break;
      case 'rollback':
        console.log('Processing rollback request');
        result = await processRollbackRequest(req.query);
        break;
      default:
        console.log('Invalid action type:', action);
        result = {
          status: '400',
          msg: 'Invalid action'
        };
    }

    console.log('Response result:', result);
    console.log('=== END UNIFIED CALLBACK REQUEST ===\n');

    // Always return HTTP 200 with result in body as required by API
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in unifiedCallbackController:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    
    // Always return HTTP 200 with error in body as required by API
    return res.status(200).json({
      status: '500',
      msg: 'Internal server error'
    });
  }
};


/**
 * Controller to serve a test page for seamless integration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const testPageController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get game list
    const gameList = await getGameList();
    if (!gameList.success) {
      return res.status(400).json(gameList);
    }
    
    // Generate HTML for the test page
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Seamless Integration Test Page</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          h1, h2 {
            color: #333;
          }
          .container {
            display: flex;
            flex-wrap: wrap;
          }
          .section {
            flex: 1;
            min-width: 300px;
            margin: 10px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .game-list {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #ddd;
            padding: 10px;
            margin-top: 10px;
          }
          .game-item {
            padding: 8px;
            margin-bottom: 5px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
          }
          .game-item:hover {
            background-color: #f0f0f0;
          }
          .btn {
            display: inline-block;
            padding: 8px 16px;
            margin: 5px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            border: none;
            cursor: pointer;
          }
          .btn-blue {
            background-color: #2196F3;
          }
          .btn-red {
            background-color: #f44336;
          }
          #gameFrame {
            width: 100%;
            height: 600px;
            border: none;
            display: none;
            margin-top: 20px;
          }
          .loader {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 2s linear infinite;
            display: inline-block;
            margin-left: 10px;
            vertical-align: middle;
            display: none;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          #balanceInfo {
            font-size: 16px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <h1>Seamless Integration Test Page</h1>
        
        <div class="container">
          <div class="section">
            <h2>Wallet Information</h2>
            <div id="balanceInfo">Loading balances...</div>
            <button id="refreshBalance" class="btn">Refresh Balance</button>
            <button id="transferToMain" class="btn btn-blue">Transfer to Main Wallet</button>
            <button id="transferToThirdParty" class="btn btn-blue">Transfer to Third Party Wallet</button>
          </div>
          
          <div class="section">
            <h2>Launch Methods</h2>
            <p>Select a method to launch games:</p>
            <div>
              <button id="methodApi" class="btn btn-blue">API Response (Direct Client)</button>
              <button id="methodIframe" class="btn">Iframe Embed (Server)</button>
              <button id="methodRedirect" class="btn">Redirect (Server)</button>
            </div>
          </div>
        </div>
        
        <div class="container">
          <div class="section">
            <h2>Available Games</h2>
            <input type="text" id="searchGames" placeholder="Search games..." style="width: 100%; padding: 8px; margin-bottom: 10px;">
            <div class="game-list" id="gameList">
              ${gameList.games.map(game => `
                <div class="game-item" data-game-id="${game.gamehash}">
                  <strong>${game.gamename}</strong><br>
                  Provider: ${game.system}
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="section">
            <h2>Game Preview</h2>
            <div id="gameActions" style="display: none;">
              <button id="closeGame" class="btn btn-red">Close Game</button>
            </div>
            <div id="loadingGame" style="display: none;">
              <span>Loading game...</span>
              <div class="loader" style="display: inline-block;"></div>
            </div>
            <iframe id="gameFrame" allowfullscreen></iframe>
          </div>
        </div>
        
        <script>
          // Selected method
          let launchMethod = 'iframe'; // Default to iframe
          
          // Select method buttons
          document.getElementById('methodApi').addEventListener('click', () => {
            launchMethod = 'api';
            document.querySelectorAll('.section button').forEach(btn => btn.classList.remove('btn-blue'));
            document.getElementById('methodApi').classList.add('btn-blue');
          });
          
          document.getElementById('methodIframe').addEventListener('click', () => {
            launchMethod = 'iframe';
            document.querySelectorAll('.section button').forEach(btn => btn.classList.remove('btn-blue'));
            document.getElementById('methodIframe').classList.add('btn-blue');
          });
          
          document.getElementById('methodRedirect').addEventListener('click', () => {
            launchMethod = 'redirect';
            document.querySelectorAll('.section button').forEach(btn => btn.classList.remove('btn-blue'));
            document.getElementById('methodRedirect').classList.add('btn-blue');
          });
          
          // Game item click handler
          document.querySelectorAll('.game-item').forEach(item => {
            item.addEventListener('click', async () => {
              const gameId = item.dataset.gameId;
              document.getElementById('loadingGame').style.display = 'block';
              document.getElementById('gameFrame').style.display = 'none';
              
              if (launchMethod === 'api') {
                try {
                  const response = await fetch(\`/api/seamless/launch/\${gameId}\`);
                  const data = await response.json();
                  
                  if (data.success) {
                    document.getElementById('gameFrame').src = data.gameUrl;
                    document.getElementById('gameFrame').style.display = 'block';
                    document.getElementById('gameActions').style.display = 'block';
                  } else {
                    alert('Error launching game: ' + data.message);
                  }
                } catch (error) {
                  alert('Error launching game: ' + error.message);
                }
              } else if (launchMethod === 'iframe') {
                document.getElementById('gameFrame').src = \`/api/seamless/iframe/\${gameId}\`;
                document.getElementById('gameFrame').style.display = 'block';
                document.getElementById('gameActions').style.display = 'block';
              } else if (launchMethod === 'redirect') {
                window.open(\`/api/seamless/redirect/\${gameId}\`, '_blank');
              }
              
              document.getElementById('loadingGame').style.display = 'none';
            });
          });
          
          // Close game button
          document.getElementById('closeGame').addEventListener('click', () => {
            document.getElementById('gameFrame').src = '';
            document.getElementById('gameFrame').style.display = 'none';
            document.getElementById('gameActions').style.display = 'none';
          });
          
          // Search games
          document.getElementById('searchGames').addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelectorAll('.game-item').forEach(item => {
              const gameName = item.textContent.toLowerCase();
              item.style.display = gameName.includes(searchTerm) ? 'block' : 'none';
            });
          });
          
          // Load balance information
          async function loadBalances() {
            try {
              const response = await fetch('/api/wallet/balances');
              const data = await response.json();
              
              if (data.success) {
                const balanceHtml = \`
                  <div><strong>Main Wallet:</strong> \${data.mainWallet.balance.toFixed(2)} \${data.mainWallet.currency}</div>
                  <div><strong>Third Party Wallet:</strong> \${data.thirdPartyWallet.balance.toFixed(2)} \${data.thirdPartyWallet.currency}</div>
                \`;
                document.getElementById('balanceInfo').innerHTML = balanceHtml;
              } else {
                document.getElementById('balanceInfo').innerHTML = 'Error loading balances';
              }
            } catch (error) {
              document.getElementById('balanceInfo').innerHTML = 'Error loading balances: ' + error.message;
            }
          }
          
          // Refresh balance button
          document.getElementById('refreshBalance').addEventListener('click', loadBalances);
          
          // Transfer to main wallet
          document.getElementById('transferToMain').addEventListener('click', async () => {
            try {
              const response = await fetch('/api/wallet/transfer-from-third-party', {
                method: 'POST'
              });
              const data = await response.json();
              
              if (data.success) {
                alert('Transfer successful');
                loadBalances();
              } else {
                alert('Transfer failed: ' + data.message);
              }
            } catch (error) {
              alert('Transfer error: ' + error.message);
            }
          });
          
          // Transfer to third party wallet
          document.getElementById('transferToThirdParty').addEventListener('click', async () => {
            try {
              // This endpoint doesn't exist yet but we can reuse the route
              const response = await fetch('/api/seamless/transfer-to-third-party', {
                method: 'POST'
              });
              const data = await response.json();
              
              if (data.success) {
                alert('Transfer successful');
                loadBalances();
              } else {
                alert('Transfer failed: ' + data.message);
              }
            } catch (error) {
              alert('Transfer error: ' + error.message);
            }
          });
          
          // Load balances on page load
          loadBalances();
        </script>
      </body>
      </html>
    `;
    
    // Send the HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error in testPageController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating test page'
    });
  }
};

/**
 * Controller to fetch filtered list of games
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFilteredGamesController = async (req, res) => {
  try {
    // Extract filter parameters from query
    const { 
      currency,
      category,
      provider,
      mobile,
      jackpot,
      freerounds,
      limit
    } = req.query;
    
    // Create filters object
    const filters = {};
    
    if (category) filters.category = category;
    if (provider) filters.provider = provider;
    if (mobile === 'true') filters.mobile = true;
    if (jackpot === 'true') filters.jackpot = true;
    if (freerounds === 'true') filters.freerounds = true;
    
    // Get filtered games
    const result = await getGameList(currency, filters);
    
    if (result.success) {
      // Limit the number of games if requested
      if (limit && !isNaN(parseInt(limit))) {
        result.games = result.games.slice(0, parseInt(limit));
      }
      
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in getFilteredGamesController:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching filtered games list'
    });
  }
};

/**
 * Controller to fetch games list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGamesList = async (req, res) => {
  try {
    console.log('=== GAMES LIST REQUEST START ===');
    console.log('Raw query parameters:', req.query);
    
    const { currency, provider, page, limit } = req.query;
    
    // Create filters object
    const filters = {};
    if (provider) {
      filters.provider = provider.toLowerCase();
      console.log('Adding provider filter:', filters.provider);
    }
    
    // Add pagination parameters
    if (page) filters.page = page;
    if (limit) filters.limit = limit;
    
    console.log('Final filters object:', filters);
    
    const result = await getGameList(currency, filters);
    
    console.log('Service response:', {
      success: result.success,
      gamesCount: result.games?.length || 0,
      totalCount: result.totalCount,
      filteredCount: result.filteredCount,
      pagination: result.pagination
    });
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        games: result.games,
        totalCount: result.totalCount,
        filteredCount: result.filteredCount,
        pagination: result.pagination
      });
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in getGamesList:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching games list'
    });
  }
};

// Helper function to get provider name from code
const getProviderName = (code) => {
  const providerNames = {
    'bs': 'Betsoft',
    'bp': 'Blueprint',
    'ep': 'Evoplay',
    'pg': 'Pragmatic Play',
    'ag': 'Asia Gaming',
    'ev': 'Evolution',
    'bl': 'Bombay Live',
    'g24': 'G24',
    'vg': 'Vivo Gaming',
    'ez': 'Ezugi',
    'dt': 'Digitain',
    'ds': 'Delasport'
  };
  return providerNames[code?.toLowerCase()] || code;
};

// Force refresh games list cache
const refreshGamesList = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await seamlessService.refreshGamesList(userId);
    
    if (result.success) {
      res.json({
        success: true,
        games: result.games,
        message: result.message
      });
    } else {
      res.status(result.message.includes('Unauthorized') ? 403 : 500).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error in refreshGamesList controller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error refreshing games list'
    });
  }
};

module.exports = {
  unifiedCallbackController,
  getGamesController,
  launchGameController,
  balanceCallbackController,
  debitCallbackController,
  creditCallbackController,
  rollbackCallbackController,
  addFreeRoundsController,
  removeFreeRoundsController,
  unifiedCallbackController,
  serveGameInIframeController,
  redirectToGameController,
  testPageController,
  getFilteredGamesController,
  getGamesList,
  refreshGamesList,
  debugSeamlessIntegration,
  healthCheckController
};