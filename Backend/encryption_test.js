async getGameUrl(userId, gameUid, options = {}) {
    const t = await sequelize.transaction();
    
    try {
      console.log('🎮 === CASINO GAME LAUNCH (CORRECTED STRING KEY METHOD) ===');
      console.log('🎮 User ID:', userId);
      console.log('🎮 Game UID:', gameUid);
  
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
  
      // Prepare data
      let memberAccount = user.user_name;
      if (memberAccount.length < 4) {
        memberAccount = `user_${memberAccount}`;
      } else if (memberAccount.length > 20) {
        memberAccount = memberAccount.substring(0, 20);
      }
      
      const walletCurrency = walletResult.currency || this.config.default_currency;
      const timestamp = this.encryption.generateTimestamp();
      const creditAmount = Math.min(parseFloat(balance), 1000000).toFixed(2);
  
      console.log('🔑 Using String Key encryption method (the one that worked!)');
      
      // TEST 1: Add agency_uid INSIDE the payload (API documentation suggests this)
      const payloadWithAgency = {
        agency_uid: this.config.agency_uid,  // Add agency_uid inside payload
        timestamp: parseInt(timestamp),      // API might expect integer timestamp
        member_account: memberAccount,
        game_uid: gameUid,
        credit_amount: creditAmount,
        currency_code: walletCurrency,
        language: options.language || 'en',
        home_url: this.config.home_url,
        platform: options.platform || 'web',
        callback_url: this.config.callback_url
      };
  
      console.log('📦 Payload WITH agency_uid inside:', JSON.stringify(payloadWithAgency, null, 2));
  
      try {
        console.log('🔐 === TESTING STRING KEY WITH AGENCY_UID INSIDE PAYLOAD ===');
        
        // Use the String Key encryption method that worked
        const encryptedPayload = this.encryption.encryptStringKey(JSON.stringify(payloadWithAgency));
        
        if (!encryptedPayload) {
          throw new Error('String Key encryption failed');
        }
  
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
  
        console.log('📡 Making API request with corrected String Key encryption...');
  
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
  
        console.log('📡 Response:', response.data);
  
        if (response.data.code === 0) {
          console.log('🎉 SUCCESS! String Key method with agency_uid inside payload works!');
          
          // Decrypt response
          let decryptedPayload;
          try {
            decryptedPayload = JSON.parse(this.encryption.decrypt(response.data.payload));
          } catch (decryptError) {
            console.log('⚠️ Using response as-is, decryption not critical for URL extraction');
            decryptedPayload = response.data.payload;
          }
          
          console.log('🔓 Response payload:', decryptedPayload);
  
          const gameLaunchUrl = decryptedPayload.game_launch_url || decryptedPayload;
  
          // Create game session
          const CasinoGameSession = require('../models/CasinoGameSession');
          const gameSession = await CasinoGameSession.create({
            user_id: userId,
            member_account: memberAccount,
            game_uid: gameUid,
            game_launch_url: gameLaunchUrl,
            credit_amount: creditAmount,
            currency_code: walletCurrency,
            language: payloadWithAgency.language,
            platform: payloadWithAgency.platform,
            ip_address: options.ipAddress || '127.0.0.1'
          }, { transaction: t });
  
          await t.commit();
  
          return {
            success: true,
            gameUrl: gameLaunchUrl,
            sessionId: gameSession.session_id,
            memberAccount: memberAccount,
            balance: creditAmount,
            currency: walletCurrency,
            debug: {
              successful_method: 'String Key with agency_uid inside payload',
              payload_used: payloadWithAgency,
              response: response.data
            }
          };
        } else {
          console.log(`❌ Still failed with code ${response.data.code}: ${response.data.msg}`);
          
          if (response.data.code === 10022) {
            console.log('💡 Still getting "agency_uid cannot be empty" - trying alternative approach...');
            
            // TEST 2: Try without agency_uid in payload but ensure it's preserved in outer request
            const payloadWithoutAgency = {
              member_account: memberAccount,
              game_uid: gameUid,
              credit_amount: creditAmount,
              currency_code: walletCurrency,
              language: options.language || 'en',
              home_url: this.config.home_url,
              platform: options.platform || 'web',
              callback_url: this.config.callback_url
            };
  
            console.log('\n🔐 === TESTING STRING KEY WITHOUT AGENCY_UID IN PAYLOAD ===');
            console.log('📦 Payload WITHOUT agency_uid:', JSON.stringify(payloadWithoutAgency, null, 2));
            
            const encryptedPayload2 = this.encryption.encryptStringKey(JSON.stringify(payloadWithoutAgency));
            
            const encryptedRequest2 = {
              agency_uid: this.config.agency_uid, // Ensure this is definitely not empty
              timestamp: timestamp,
              payload: encryptedPayload2
            };
  
            console.log('📤 Double-checking outer request agency_uid:', encryptedRequest2.agency_uid);
            console.log('📤 Agency UID length:', encryptedRequest2.agency_uid.length);
            console.log('📤 Agency UID is empty?', !encryptedRequest2.agency_uid);
  
            const response2 = await axios.post(
              `${this.config.server_url}${this.config.endpoints.game_v1}`,
              encryptedRequest2,
              {
                headers: {
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              }
            );
  
            console.log('📡 Response 2:', response2.data);
  
            if (response2.data.code === 0) {
              console.log('🎉 SUCCESS! String Key method without agency_uid in payload works!');
              
              const gameLaunchUrl2 = response2.data.payload?.game_launch_url || response2.data.payload;
  
              // Create game session
              const gameSession2 = await CasinoGameSession.create({
                user_id: userId,
                member_account: memberAccount,
                game_uid: gameUid,
                game_launch_url: gameLaunchUrl2,
                credit_amount: creditAmount,
                currency_code: walletCurrency,
                language: payloadWithoutAgency.language,
                platform: payloadWithoutAgency.platform,
                ip_address: options.ipAddress || '127.0.0.1'
              }, { transaction: t });
  
              await t.commit();
  
              return {
                success: true,
                gameUrl: gameLaunchUrl2,
                sessionId: gameSession2.session_id,
                memberAccount: memberAccount,
                balance: creditAmount,
                currency: walletCurrency,
                debug: {
                  successful_method: 'String Key without agency_uid in payload',
                  payload_used: payloadWithoutAgency,
                  response: response2.data
                }
              };
            }
          }
        }
        
      } catch (error) {
        console.log('❌ String Key method error:', error.message);
        if (error.response) {
          console.log('Error response:', error.response.data);
        }
      }
  
      await t.rollback();
  
      return {
        success: false,
        message: 'String Key encryption method failed - this was our best lead',
        debug: {
          issue: 'String Key can decrypt but agency_uid field has problems',
          suggestion: 'Contact casino provider - we found the right encryption but field structure issue'
        }
      };
  
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