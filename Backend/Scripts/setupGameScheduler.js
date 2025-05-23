require('dotenv').config();
const cron = require('node-cron');
const gameLogicService = require('../services/gameLogicService');
const periodService = require('../services/periodService');

/**
 * Set up game scheduler to automatically process game results
 */
function setupGameScheduler() {
  console.log('Setting up game scheduler...');

  // Wingo 30s periods
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const gameType = 'wingo';
      const duration = 30;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing wingo 30s period:', error);
    }
  });

  // Wingo 60s periods
  cron.schedule('0 * * * * *', async () => {
    try {
      const gameType = 'wingo';
      const duration = 60;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing wingo 60s period:', error);
    }
  });

  // Wingo 180s (3m) periods
  cron.schedule('0 */3 * * * *', async () => {
    try {
      const gameType = 'wingo';
      const duration = 180;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing wingo 180s period:', error);
    }
  });

  // Wingo 300s (5m) periods
  cron.schedule('0 */5 * * * *', async () => {
    try {
      const gameType = 'wingo';
      const duration = 300;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing wingo 300s period:', error);
    }
  });

  // 5D 60s periods
  cron.schedule('0 * * * * *', async () => {
    try {
      const gameType = 'fiveD';
      const duration = 60;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing 5D 60s period:', error);
    }
  });

  // 5D 180s (3m) periods
  cron.schedule('0 */3 * * * *', async () => {
    try {
      const gameType = 'fiveD';
      const duration = 180;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing 5D 180s period:', error);
    }
  });

  // 5D 300s (5m) periods
  cron.schedule('0 */5 * * * *', async () => {
    try {
      const gameType = 'fiveD';
      const duration = 300;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing 5D 300s period:', error);
    }
  });

  // 5D 600s (10m) periods
  cron.schedule('0 */10 * * * *', async () => {
    try {
      const gameType = 'fiveD';
      const duration = 600;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing 5D 600s period:', error);
    }
  });

  // K3 60s periods
  cron.schedule('0 * * * * *', async () => {
    try {
      const gameType = 'k3';
      const duration = 60;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing K3 60s period:', error);
    }
  });

  // K3 180s (3m) periods
  cron.schedule('0 */3 * * * *', async () => {
    try {
      const gameType = 'k3';
      const duration = 180;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing K3 180s period:', error);
    }
  });

  // K3 300s (5m) periods
  cron.schedule('0 */5 * * * *', async () => {
    try {
      const gameType = 'k3';
      const duration = 300;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing K3 300s period:', error);
    }
  });

  // K3 600s (10m) periods
  cron.schedule('0 */10 * * * *', async () => {
    try {
      const gameType = 'k3';
      const duration = 600;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing K3 600s period:', error);
    }
  });

  // TRX Wix 30s periods
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const gameType = 'trx_wix';
      const duration = 30;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing trx_wix 30s period:', error);
    }
  });

  // TRX Wix 60s periods
  cron.schedule('0 * * * * *', async () => {
    try {
      const gameType = 'trx_wix';
      const duration = 60;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing trx_wix 60s period:', error);
    }
  });

  // TRX Wix 180s (3m) periods
  cron.schedule('0 */3 * * * *', async () => {
    try {
      const gameType = 'trx_wix';
      const duration = 180;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing trx_wix 180s period:', error);
    }
  });

  // TRX Wix 300s (5m) periods
  cron.schedule('0 */5 * * * *', async () => {
    try {
      const gameType = 'trx_wix';
      const duration = 300;
      const periodId = await periodService.generatePeriodId(gameType, duration);
      console.log(`Processing ${gameType} ${duration}s period: ${periodId}`);
      await gameLogicService.processGameResults(gameType, duration, periodId);
    } catch (error) {
      console.error('Error processing trx_wix 300s period:', error);
    }
  });

  console.log('Game scheduler set up successfully.');
}

// If this file is run directly, start the scheduler
if (require.main === module) {
  setupGameScheduler();
} else {
  // Export for use in other files
  module.exports = setupGameScheduler;
} 