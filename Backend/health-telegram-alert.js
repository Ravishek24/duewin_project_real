// Backend/health-telegram-alert.js
// Script to check health endpoint and send Telegram alert if unhealthy

const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

// === CONFIGURATION ===
const TELEGRAM_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN'; // <-- Replace with your bot token
const CHAT_USERNAME = 'killer_mao'; // Telegram username
const HEALTH_URL = 'https://api.strikecolor1.com/health';

// Helper to get chat ID from username (run once, then hardcode chat ID for reliability)
async function getChatId(bot, username) {
  try {
    const updates = await bot.getUpdates();
    for (const update of updates) {
      if (update.message && update.message.from && update.message.from.username === username.replace('@', '')) {
        return update.message.from.id;
      }
    }
    throw new Error('No message found from user. Please send a message to your bot first.');
  } catch (err) {
    throw new Error('Failed to get chat ID: ' + err.message);
  }
}

async function sendTelegramAlert(bot, chatId, message) {
  try {
    await bot.sendMessage(chatId, message);
    console.log('Telegram alert sent.');
  } catch (err) {
    console.error('Failed to send Telegram alert:', err.message);
  }
}

async function checkHealth() {
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
  let chatId = null;

  // You can hardcode your chat ID here after first run for reliability
  // chatId = 123456789;

  try {
    // If chatId is not set, try to get it from username
    if (!chatId) {
      chatId = await getChatId(bot, CHAT_USERNAME);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  try {
    const res = await axios.get(HEALTH_URL, { timeout: 10000 });
    if (res.status === 200 && res.data.status === 'ok') {
      console.log('Health check passed:', res.data);
    } else {
      await sendTelegramAlert(
        bot,
        chatId,
        `❌ Health check failed: Unexpected response from health endpoint: ${JSON.stringify(res.data)}`
      );
    }
  } catch (err) {
    await sendTelegramAlert(
      bot,
      chatId,
      `❌ Health check failed: ${err.message}`
    );
  }
}

checkHealth(); 