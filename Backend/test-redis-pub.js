let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



require('dotenv').config();

const redis = 

redis.on('connect', () => console.log('Publisher connected'));
redis.on('error', err => console.error('Publisher error:', err));

setInterval(() => {
  const msg = `Test message at ${new Date().toISOString()}`;
  redis.publish('test_channel', msg).then(count => {
    console.log(`Published: "${msg}" to ${count} subscribers`);
  });
}, 2000); 
module.exports = { setRedisHelper };
