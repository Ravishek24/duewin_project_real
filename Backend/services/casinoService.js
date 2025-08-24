const axios = require('axios');
const { sequelize } = require('../config/db');
const CasinoEncryption = require('./casinoEncryption');
const thirdPartyWalletService = require('./thirdPartyWalletService');

/**
 * Casino Service - Production Ready Implementation
 * Uses confirmed working UTF-8 string key encryption method
 * 
 * NOTE: According to the official API documentation, the casino provider only has these endpoints:
 * - /game/v1 (SEAMLESS game launch) - POST with encryption
 * - /game/v2 (TRANSFER game launch) - POST with encryption  
 * - /game/transaction/list (Transaction records) - POST with encryption
 * 
 * There are NO game list or provider list endpoints in the API.
 * Games must be obtained through individual game launch or admin panel.
 */
class CasinoService {
  constructor() {
    // Load configuration from environment variables
    this.config = {
      agency_uid: process.env.CASINO_AGENCY_UID,
      aes_key: process.env.CASINO_AES_KEY,
      server_url: process.env.CASINO_SERVER_URL || 'https://jsgame.live',
      
             // API Endpoints
       endpoints: {
         game_v1: '/game/v1',           // SEAMLESS game launch
         game_v2: '/game/v2',           // TRANSFER game launch
         transaction_list: '/game/transaction/list'
         // NOTE: No game list or provider list endpoints exist in the API
       },
      
      // Default Settings
      default_currency: 'USD',
      default_language: 'en',
      default_platform: 1, // Integer 1 for web
      
      // URLs
      home_url: process.env.FRONTEND_URL || 'https://duewingame-three.vercel.app',
      callback_url: process.env.CASINO_CALLBACK_URL || 'https://api.strikecolor1.com/api/casino/callback',
      
      // Security Settings
      timestamp_tolerance: 5 * 60 * 1000, // 5 minutes in milliseconds
      
      // Balance limits
      max_credit_amount: 100000, // Maximum credit amount per session
      min_credit_amount: 1       // Minimum credit amount
    };

    // Validate required configuration
    if (!this.config.agency_uid || !this.config.aes_key) {
      throw new Error('Missing required casino configuration: CASINO_AGENCY_UID and CASINO_AES_KEY must be set in environment variables');
    }

    // Initialize encryption service with confirmed working method
    this.encryption = new CasinoEncryption(this.config.aes_key);
    
    console.log('🎰 Casino Service initialized successfully');
    console.log('🏢 Agency UID:', this.config.agency_uid);
    console.log('🌐 Server URL:', this.config.server_url);
  }

  /**
   * Get game launch URL - CONFIRMED WORKING IMPLEMENTATION
   * @param {number} userId - User ID
   * @param {string} gameUid - Game UID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Game launch result
   */
  async getGameUrl(userId, gameUid, options = {}) {
    const t = await sequelize.transaction();
    
    try {
      console.log('🎮 === CASINO GAME LAUNCH (PRODUCTION) ===');
      console.log('🎮 User ID:', userId);
      console.log('🎮 Game UID:', gameUid);
      console.log('🎮 Options:', options);

      // Get user information
      const User = require('../models/User');
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        await t.rollback();
        return { success: false, message: 'User not found' };
      }

      // Get third-party wallet balance
      const walletResult = await thirdPartyWalletService.getBalance(userId);
      if (!walletResult.success) {
        await t.rollback();
        return { success: false, message: 'Failed to get wallet balance' };
      }

      const balance = walletResult.balance;
      console.log('💰 Wallet balance:', balance);

      if (balance <= 0) {
        await t.rollback();
        return { 
          success: false, 
          message: 'Insufficient balance in third-party wallet'
        };
      }

      // CONFIRMED WORKING: Generate member_account with h7778e_ prefix
      let memberAccountBase = user.user_name;
      
      // Ensure base account name is within limits (leaving room for prefix)
      if (memberAccountBase.length < 4) {
        memberAccountBase = `user_${memberAccountBase}`;
      } else if (memberAccountBase.length > 15) {
        memberAccountBase = memberAccountBase.substring(0, 15);
      }
      
      const memberAccount = `h7778e_${memberAccountBase}`;
      console.log('👤 Member account with required prefix:', memberAccount);

      const walletCurrency = options.currency || walletResult.currency || this.config.default_currency;
      const timestamp = this.encryption.generateTimestamp();
      const creditAmount = Math.min(parseFloat(balance), this.config.max_credit_amount).toFixed(2);

      // CONFIRMED WORKING: Full payload structure with agency_uid inside
      const payload = {
        timestamp: timestamp,                    // ✅ Timestamp inside payload
        agency_uid: this.config.agency_uid,      // ✅ Agency UID inside payload
        member_account: memberAccount,           // ✅ With h7778e_ prefix
        game_uid: gameUid,                      // ✅ Game UID
        credit_amount: creditAmount,            // ✅ Credit amount as string
        currency_code: walletCurrency,          // ✅ Currency code
        language: options.language || this.config.default_language,
        home_url: this.config.home_url,         // ✅ Home URL
        platform: options.platform || this.config.default_platform, // ✅ Integer platform
        callback_url: this.config.callback_url  // ✅ Callback URL
      };

      console.log('📦 CONFIRMED WORKING payload structure:', JSON.stringify(payload, null, 2));

      // CONFIRMED WORKING: UTF-8 string key encryption
      const encryptedPayload = this.encryption.encrypt(JSON.stringify(payload));
      
      const encryptedRequest = {
        agency_uid: this.config.agency_uid,
        timestamp: timestamp,
        payload: encryptedPayload
      };

      console.log('📤 Request structure:', {
        agency_uid: encryptedRequest.agency_uid,
        timestamp: encryptedRequest.timestamp,
        payload_length: encryptedRequest.payload.length
      });

      console.log('📡 Making API request to casino provider...');

      const response = await axios.post(
        `${this.config.server_url}${this.config.endpoints.game_v1}`,
        encryptedRequest,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('📡 Casino API Response:', response.data);

      if (response.data.code === 0) {
        console.log('🎉 SUCCESS! Game launched successfully!');
        
        // Decrypt response payload
        let decryptedPayload;
        try {
          if (response.data.payload && response.data.payload !== '') {
            decryptedPayload = this.encryption.decryptPayload(response.data.payload);
          } else {
            decryptedPayload = response.data;
          }
        } catch (decryptError) {
          console.log('⚠️ Response payload decryption not required');
          decryptedPayload = response.data;
        }
        
        console.log('🔓 Response payload:', decryptedPayload);

        const gameLaunchUrl = decryptedPayload.game_launch_url || 
                             decryptedPayload.payload?.game_launch_url || 
                             'Game launched successfully';

        // Create game session
        const CasinoGameSession = require('../models/CasinoGameSession');
        const gameSession = await CasinoGameSession.create({
          user_id: userId,
          member_account: memberAccount,
          game_uid: gameUid,
          game_launch_url: gameLaunchUrl,
          credit_amount: creditAmount,
          currency_code: payload.currency_code,
          language: payload.language,
          platform: payload.platform.toString(),
          ip_address: options.ipAddress || '127.0.0.1'
        }, { transaction: t });

        console.log('✅ Game session created:', gameSession.session_id);

        await t.commit();

        return {
          success: true,
          gameUrl: gameLaunchUrl,
          sessionId: gameSession.session_id,
          memberAccount: memberAccount,
          balance: creditAmount,
          currency: payload.currency_code
        };

      } else {
        await t.rollback();
        
        console.log(`❌ Game launch failed with code ${response.data.code}: ${response.data.msg}`);
        
        // Enhanced error handling based on confirmed error codes
        let errorMessage = response.data.msg || 'Unknown error';
        let suggestion = '';
        
        switch (response.data.code) {
          case 10002:
            suggestion = 'Agency does not exist. Check CASINO_AGENCY_UID environment variable.';
            break;
          case 10004:
            suggestion = 'Payload error. Check encryption method and field formats.';
            break;
          case 10008:
            suggestion = 'Game does not exist. Contact casino provider for available games.';
            break;
          case 10017:
            suggestion = 'Game not available. Contact casino provider for available game list.';
            break;
          case 10022:
            suggestion = 'Field validation error. Check member_account format and required fields.';
            break;
          case 10025:
            suggestion = 'Insufficient wallet balance.';
            break;
          default:
            suggestion = 'Contact casino provider for assistance.';
        }
        
        return {
          success: false,
          message: errorMessage,
          error_code: response.data.code,
          suggestion: suggestion
        };
      }

    } catch (error) {
      await t.rollback();
      console.error('❌ Casino game launch error:', error);
      
      return {
        success: false,
        message: error.message || 'Failed to launch game',
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Get available games from casino provider
   * NOTE: The casino API does NOT have a game list endpoint
   * Games must be obtained through individual game launch or admin panel
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Game list result
   */
  async getGameList(options = {}) {
    try {
      console.log('🎮 === GETTING CASINO GAME LIST ===');
      console.log('⚠️ IMPORTANT: Casino API does NOT have a /game/list endpoint');
      console.log('📚 According to API documentation, only these endpoints exist:');
      console.log('   - /game/v1 (SEAMLESS game launch)');
      console.log('   - /game/v2 (TRANSFER game launch)');
      console.log('   - /game/transaction/list (Transaction records)');
      
      // Return a comprehensive explanation of the limitation
      return {
        success: false,
        message: 'Game list endpoint does not exist in casino API',
        error_code: 'ENDPOINT_NOT_EXISTS',
        api_documentation: {
          available_endpoints: [
            '/game/v1 - Game launch (SEAMLESS)',
            '/game/v2 - Game launch (TRANSFER)',
            '/game/transaction/list - Transaction records'
          ],
          missing_endpoints: [
            '/game/list - Game list (NOT IMPLEMENTED)',
            '/game/provider/list - Provider list (NOT IMPLEMENTED)'
          ]
        },
        recommendations: [
          'Contact casino provider for available game UIDs',
          'Implement game catalog in your admin panel',
          'Use individual game launch with known game UIDs',
          'Check if games are available through a different method'
        ],
        source: 'casino_api_documentation_analysis'
      };

    } catch (error) {
      console.error('❌ Casino get game list error:', error);
      
      return {
        success: false,
        message: 'Failed to get game list from casino provider',
        error: error.message,
        error_details: error.response?.data
      };
    }
  }

  /**
   * Get list of all available casino providers
   * NOTE: The casino API does NOT have a provider list endpoint
   * Providers must be obtained through individual game launch or admin panel
   * @returns {Promise<Object>} Provider list result
   */
  async getProviderList() {
    try {
      console.log('🏢 === GETTING CASINO PROVIDER LIST ===');
      console.log('⚠️ IMPORTANT: Casino API does NOT have a /game/provider/list endpoint');
      console.log('📚 According to API documentation, only these endpoints exist:');
      console.log('   - /game/v1 (SEAMLESS game launch)');
      console.log('   - /game/v2 (TRANSFER game launch)');
      console.log('   - /game/transaction/list (Transaction records)');
      
      // Return a comprehensive explanation of the limitation
      return {
        success: false,
        message: 'Provider list endpoint does not exist in casino API',
        error_code: 'ENDPOINT_NOT_EXISTS',
        api_documentation: {
          available_endpoints: [
            '/game/v1 - Game launch (SEAMLESS)',
            '/game/v2 - Game launch (TRANSFER)',
            '/game/transaction/list - Transaction records'
          ],
          missing_endpoints: [
            '/game/list - Game list (NOT IMPLEMENTED)',
            '/game/provider/list - Provider list (NOT IMPLEMENTED)'
          ]
        },
        recommendations: [
          'Contact casino provider for available game UIDs and providers',
          'Implement provider catalog in your admin panel',
          'Use individual game launch with known game UIDs',
          'Check if provider information is available through a different method'
        ],
        source: 'casino_api_documentation_analysis'
      };

    } catch (error) {
      console.error('❌ Casino get provider list error:', error);
      
      return {
        success: false,
        message: 'Failed to get provider list from casino provider',
        error: error.message,
        error_details: error.response?.data
      };
    }
  }

  /**
   * Process callback from casino provider - CONFIRMED WORKING
   * @param {Object} callbackData - Raw callback data
   * @returns {Promise<Object>} Processed result
   */
  async processCallback(callbackData) {
    try {
      console.log('📞 === CASINO CALLBACK PROCESSING ===');
      console.log('📞 Raw callback data:', callbackData);

      // Validate required fields
      const { agency_uid, timestamp, payload: encryptedPayload } = callbackData;
      
      if (!agency_uid || !timestamp || !encryptedPayload) {
        throw new Error('Missing required callback fields');
      }

      // Validate agency UID
      if (agency_uid !== this.config.agency_uid) {
        throw new Error('Invalid agency UID');
      }

      // Validate timestamp
      if (!this.encryption.validateTimestamp(timestamp, this.config.timestamp_tolerance)) {
        throw new Error('Invalid or expired timestamp');
      }

      // Decrypt payload using confirmed working method
      const decryptedPayload = this.encryption.decryptPayload(encryptedPayload);
      console.log('🔓 Decrypted callback payload:', decryptedPayload);

      // Process based on transaction type
      let result;
      
      if (decryptedPayload.bet_amount !== undefined) {
        // This is a bet transaction
        result = await this.processBetTransaction(decryptedPayload);
      } else if (decryptedPayload.win_amount !== undefined) {
        // This is a win transaction
        result = await this.processWinTransaction(decryptedPayload);
      } else {
        // This might be a balance check or other transaction
        result = await this.processBalanceTransaction(decryptedPayload);
      }

      // Encrypt response using confirmed working method
      const responsePayload = {
        credit_amount: result.balance.toString(),
        timestamp: this.encryption.generateTimestamp()
      };

      const encryptedResponse = this.encryption.encrypt(JSON.stringify(responsePayload));

      return {
        code: 0,
        msg: '',
        payload: encryptedResponse
      };

    } catch (error) {
      console.error('❌ Casino callback processing error:', error);
      
      // Return encrypted error response
      const errorPayload = {
        credit_amount: '0',
        timestamp: this.encryption.generateTimestamp()
      };

      const encryptedErrorResponse = this.encryption.encrypt(JSON.stringify(errorPayload));

      return {
        code: 1,
        msg: error.message || 'Processing failed',
        payload: encryptedErrorResponse
      };
    }
  }

  /**
   * Process bet transaction (debit)
   * @param {Object} payload - Decrypted payload
   * @returns {Promise<Object>} Processing result
   */
  async processBetTransaction(payload) {
    const t = await sequelize.transaction();
    
    try {
      console.log('💸 === CASINO BET TRANSACTION ===');
      console.log('💸 Payload:', payload);

      const {
        serial_number,
        member_account,
        game_uid,
        bet_amount,
        currency_code,
        timestamp,
        game_round,
        data
      } = payload;

      // Find user by member account (remove h7778e_ prefix)
      const User = require('../models/User');
      const baseUsername = member_account.replace(/^h7778e_/, '');
      const user = await User.findOne({
        where: { user_name: baseUsername },
        transaction: t
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check for duplicate transaction
      const CasinoTransaction = require('../models/CasinoTransaction');
      const existingTx = await CasinoTransaction.findOne({
        where: { serial_number },
        transaction: t
      });

      if (existingTx) {
        console.log('🔄 Duplicate transaction found, returning existing result');
        await t.rollback();
        return { balance: existingTx.wallet_balance_after };
      }

      // Get current wallet balance
      const walletResult = await thirdPartyWalletService.getBalance(user.user_id);
      if (!walletResult.success) {
        throw new Error('Failed to get wallet balance');
      }

      const balanceBefore = walletResult.balance;
      const betAmount = parseFloat(bet_amount);

      // Check sufficient balance
      if (balanceBefore < betAmount) {
        throw new Error('Insufficient balance for bet');
      }

      // Update wallet balance
      const updateResult = await thirdPartyWalletService.updateBalance(user.user_id, -betAmount);
      if (!updateResult.success) {
        throw new Error('Failed to update wallet balance');
      }

      const balanceAfter = updateResult.balance;

      // Record transaction
      await CasinoTransaction.create({
        user_id: user.user_id,
        serial_number,
        member_account,
        game_uid,
        transaction_type: 'bet',
        bet_amount: betAmount,
        currency_code,
        timestamp: parseInt(timestamp),
        game_round,
        data,
        wallet_balance_before: balanceBefore,
        wallet_balance_after: balanceAfter,
        status: 'completed',
        processed_at: new Date()
      }, { transaction: t });

      console.log('✅ Bet transaction processed successfully');
      console.log(`💰 Balance: ${balanceBefore} -> ${balanceAfter}`);

      await t.commit();

      return { balance: balanceAfter };

    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Process win transaction (credit)
   * @param {Object} payload - Decrypted payload
   * @returns {Promise<Object>} Processing result
   */
  async processWinTransaction(payload) {
    const t = await sequelize.transaction();
    
    try {
      console.log('💰 === CASINO WIN TRANSACTION ===');
      console.log('💰 Payload:', payload);

      const {
        serial_number,
        member_account,
        game_uid,
        win_amount,
        currency_code,
        timestamp,
        game_round,
        data
      } = payload;

      // Find user by member account (remove h7778e_ prefix)
      const User = require('../models/User');
      const baseUsername = member_account.replace(/^h7778e_/, '');
      const user = await User.findOne({
        where: { user_name: baseUsername },
        transaction: t
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check for duplicate transaction
      const CasinoTransaction = require('../models/CasinoTransaction');
      const existingTx = await CasinoTransaction.findOne({
        where: { serial_number },
        transaction: t
      });

      if (existingTx) {
        console.log('🔄 Duplicate transaction found, returning existing result');
        await t.rollback();
        return { balance: existingTx.wallet_balance_after };
      }

      // Get current wallet balance
      const walletResult = await thirdPartyWalletService.getBalance(user.user_id);
      if (!walletResult.success) {
        throw new Error('Failed to get wallet balance');
      }

      const balanceBefore = walletResult.balance;
      const winAmount = parseFloat(win_amount);

      // Update wallet balance
      const updateResult = await thirdPartyWalletService.updateBalance(user.user_id, winAmount);
      if (!updateResult.success) {
        throw new Error('Failed to update wallet balance');
      }

      const balanceAfter = updateResult.balance;

      // Record transaction
      await CasinoTransaction.create({
        user_id: user.user_id,
        serial_number,
        member_account,
        game_uid,
        transaction_type: 'win',
        win_amount: winAmount,
        currency_code,
        timestamp: parseInt(timestamp),
        game_round,
        data,
        wallet_balance_before: balanceBefore,
        wallet_balance_after: balanceAfter,
        status: 'completed',
        processed_at: new Date()
      }, { transaction: t });

      console.log('✅ Win transaction processed successfully');
      console.log(`💰 Balance: ${balanceBefore} -> ${balanceAfter}`);

      await t.commit();

      return { balance: balanceAfter };

    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Process balance transaction
   * @param {Object} payload - Decrypted payload
   * @returns {Promise<Object>} Processing result
   */
  async processBalanceTransaction(payload) {
    try {
      console.log('💳 === CASINO BALANCE TRANSACTION ===');
      console.log('💳 Payload:', payload);

      const { member_account } = payload;

      // Find user by member account (remove h7778e_ prefix)
      const User = require('../models/User');
      const baseUsername = member_account.replace(/^h7778e_/, '');
      const user = await User.findOne({
        where: { user_name: baseUsername }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get current wallet balance
      const walletResult = await thirdPartyWalletService.getBalance(user.user_id);
      if (!walletResult.success) {
        throw new Error('Failed to get wallet balance');
      }

      console.log(`💰 Balance check: ${walletResult.balance}`);

      return { balance: walletResult.balance };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get transaction history from casino provider
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Transaction list
   */
  async getTransactionHistory(filters = {}) {
    try {
      const {
        fromDate,
        toDate,
        pageNo = 1,
        pageSize = 30
      } = filters;

      const timestamp = this.encryption.generateTimestamp();

      // Prepare payload for encryption
      const payload = {
        timestamp: timestamp,
        agency_uid: this.config.agency_uid,
        from_date: fromDate || (Date.now() - 24 * 60 * 60 * 1000).toString(), // Default: last 24 hours
        to_date: toDate || Date.now().toString(),
        page_no: pageNo,
        page_size: Math.min(pageSize, 5000) // API limit
      };

      // Encrypt payload
      const encryptedRequest = this.encryption.encryptPayload(
        payload,
        this.config.agency_uid,
        timestamp
      );

      // Make API request
      const response = await axios.post(
        `${this.config.server_url}${this.config.endpoints.transaction_list}`,
        encryptedRequest,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Casino API error: ${response.data.msg || 'Unknown error'}`);
      }

      // Decrypt response payload
      const decryptedPayload = this.encryption.decryptPayload(response.data.payload);

      return {
        success: true,
        data: decryptedPayload
      };

    } catch (error) {
      console.error('❌ Casino transaction history error:', error);
      
      return {
        success: false,
        message: error.message || 'Failed to get transaction history',
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Close game session
   * @param {number} sessionId - Session ID to close
   * @returns {Promise<Object>} Close result
   */
  async closeGameSession(sessionId) {
    try {
      console.log('🔒 === CLOSING CASINO GAME SESSION ===');
      console.log('🔒 Session ID:', sessionId);

      const CasinoGameSession = require('../models/CasinoGameSession');
      const session = await CasinoGameSession.findByPk(sessionId);

      if (!session) {
        return { success: false, message: 'Session not found' };
      }

      if (!session.is_active) {
        return { success: false, message: 'Session already closed' };
      }

      // Update session
      await session.update({
        is_active: false,
        closed_at: new Date()
      });

      console.log('✅ Game session closed successfully');

      return {
        success: true,
        message: 'Game session closed successfully'
      };

    } catch (error) {
      console.error('❌ Error closing game session:', error);
      
      return {
        success: false,
        message: 'Failed to close game session',
        error: error.message
      };
    }
  }

  /**
   * Get basic casino information and available endpoints
   * This method provides information about what's available from the casino API
   * @returns {Promise<Object>} Casino API information
   */
  async getCasinoInfo() {
    try {
      console.log('ℹ️ === GETTING CASINO API INFORMATION ===');
      
      // Test basic connectivity
      let connectivityTest = 'unknown';
      try {
        const response = await axios.get(`${this.config.server_url}/`, {
          timeout: 10000
        });
        connectivityTest = response.status === 200 ? 'connected' : `status_${response.status}`;
      } catch (error) {
        connectivityTest = `error_${error.code || 'unknown'}`;
      }

      return {
        success: true,
        casino_info: {
          server_url: this.config.server_url,
          agency_uid: this.config.agency_uid,
          encryption_method: this.encryption.algorithm,
          connectivity: connectivityTest,
                     available_endpoints: {
             game_launch_seamless: '/game/v1 (POST with encryption)',
             game_launch_transfer: '/game/v2 (POST with encryption)',
             transaction_list: '/game/transaction/list (POST with encryption)'
           },
           limitations: {
             game_list: 'Endpoint /game/list does NOT exist in API',
             provider_list: 'Endpoint /game/provider/list does NOT exist in API',
             recommendation: 'Games must be obtained through individual game launch or admin panel'
           }
        },
        source: 'casino_service_analysis'
      };

    } catch (error) {
      console.error('❌ Error getting casino info:', error);
      
      return {
        success: false,
        message: 'Failed to get casino information',
        error: error.message
      };
    }
  }
}

module.exports = new CasinoService();