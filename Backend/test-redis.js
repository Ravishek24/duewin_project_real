let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




// TODO: Replace with your actual Redis endpoint
const redis = 
  // tls: {}
});

redis.ping()
  .then(res => {
    console.log('Redis PING response:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error('Redis connection error:', err);
    process.exit(1);
  }); 
module.exports = { setRedisHelper };
