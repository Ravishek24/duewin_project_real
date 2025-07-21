let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



require('dotenv').config();

const redis = 

redis.on('connect', () => console.log('Subscriber connected'));
redis.on('error', err => console.error('Subscriber error:', err));

redis.subscribe('test_channel', (err, count) => {
  if (err) {
    console.error('Subscribe error:', err);
    return;
  }
  console.log('Subscribed to test_channel');
});

redis.on('message', (channel, message) => {
  console.log(`Received on ${channel}: ${message}`);
}); 
module.exports = { setRedisHelper };
