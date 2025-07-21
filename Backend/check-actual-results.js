let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


const { sequelize } = require('./config/db');
const { DataTypes } = require('sequelize');


// Redis configuration
const redisClient = 

// Define models
const WingoResult = sequelize.define('WingoResult', {
  bet_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bet_number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  result_of_number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  result_of_size: {
    type: DataTypes.STRING,
    allowNull: false
  },
  result_of_color: {
    type: DataTypes.STRING,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  timeline: {
    type: DataTypes.STRING,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'bet_result_wingos',
  timestamps: false
});

const TrxWixResult = sequelize.define('TrxWixResult', {
  result_id: {
    type: DataTypes.UUID,
    primaryKey: true
  },
  period: {
    type: DataTypes.STRING,
    allowNull: false
  },
  result: {
    type: DataTypes.JSON,
    allowNull: false
  },
  verification_hash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  verification_link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'bet_result_trx_wix',
  timestamps: false
});

const FiveDResult = sequelize.define('FiveDResult', {
  bet_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bet_number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  result_a: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  result_b: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  result_c: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  result_d: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  result_e: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  total_sum: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  time: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'bet_result_5ds',
  timestamps: false
});

const K3Result = sequelize.define('K3Result', {
  bet_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bet_number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dice_1: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  dice_2: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  dice_3: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sum: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  has_pair: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  has_triple: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  is_straight: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  sum_size: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sum_parity: {
    type: DataTypes.STRING,
    allowNull: false
  },
  time: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'bet_result_k3s',
  timestamps: false
});

async function getActivePeriods() {
  try {
    const gameTypes = ['wingo', 'trx_wix', 'fiveD', 'k3'];
    const durations = [30, 60, 180, 300, 600];

    for (const gameType of gameTypes) {
      console.log(`\n=== ${gameType.toUpperCase()} Active Periods ===`);
      
      for (const duration of durations) {
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Get last period ID
        const lastPeriodKey = `${gameType}:${durationKey}:lastPeriod`;
        const lastPeriodId = await redisClient.get(lastPeriodKey);
        
        if (lastPeriodId) {
          // Get period data
          const periodKey = `${gameType}:${durationKey}:${lastPeriodId}`;
          const periodData = await redisClient.get(periodKey);
          
          if (periodData) {
            const data = JSON.parse(periodData);
            
            // Check if period is still active
            const endTime = new Date(data.endTime);
            const now = new Date();
            const isActive = endTime > now;
            
            if (isActive) {
              // Get result
              const resultKey = `${gameType}:${durationKey}:${lastPeriodId}:result`;
              const result = await redisClient.get(resultKey);
              
              console.log(`\nDuration: ${duration}s`);
              console.log('Period ID:', lastPeriodId);
              console.log('Period Data:', data);
              console.log('Result:', result ? JSON.parse(result) : null);
            } else {
              // Period has ended, check if result exists
              const resultKey = `${gameType}:${durationKey}:${lastPeriodId}:result`;
              const result = await redisClient.get(resultKey);
              
              if (result) {
                console.log(`\nDuration: ${duration}s`);
                console.log('Period ID:', lastPeriodId);
                console.log('Period Data:', data);
                console.log('Result:', JSON.parse(result));
              } else {
                console.log(`\nDuration: ${duration}s - Period ${lastPeriodId} has ended but no result found`);
              }
            }
          } else {
            console.log(`\nDuration: ${duration}s - No period data found`);
          }
        } else {
          console.log(`\nDuration: ${duration}s - No active period`);
        }
      }
    }
  } catch (error) {
    console.error('Error getting active periods:', error);
  }
}

async function checkActualResults() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // Get active periods from Redis
    await getActivePeriods();

    // Get last 5 results for each game type
    const wingoResults = await WingoResult.findAll({
      order: [['created_at', 'DESC']],
      limit: 5
    });

    const trxWixResults = await TrxWixResult.findAll({
      order: [['created_at', 'DESC']],
      limit: 5
    });

    const fiveDResults = await FiveDResult.findAll({
      order: [['created_at', 'DESC']],
      limit: 5
    });

    const k3Results = await K3Result.findAll({
      order: [['created_at', 'DESC']],
      limit: 5
    });

    console.log('\n=== Last 5 Wingo Results ===');
    wingoResults.forEach(result => {
      console.log({
        period: result.bet_number,
        result: {
          number: result.result_of_number,
          color: result.result_of_color,
          size: result.result_of_size
        },
        duration: result.duration,
        timeline: result.timeline,
        created_at: result.created_at
      });
    });

    console.log('\n=== Last 5 TRX Wix Results ===');
    trxWixResults.forEach(result => {
      console.log({
        period: result.period,
        result: result.result,
        created_at: result.created_at
      });
    });

    console.log('\n=== Last 5 FiveD Results ===');
    fiveDResults.forEach(result => {
      console.log({
        period: result.bet_number,
        result: {
          A: result.result_a,
          B: result.result_b,
          C: result.result_c,
          D: result.result_d,
          E: result.result_e,
          sum: result.total_sum
        },
        time: result.time,
        created_at: result.created_at
      });
    });

    console.log('\n=== Last 5 K3 Results ===');
    k3Results.forEach(result => {
      console.log({
        period: result.bet_number,
        result: {
          dice_1: result.dice_1,
          dice_2: result.dice_2,
          dice_3: result.dice_3,
          sum: result.sum,
          has_pair: result.has_pair,
          has_triple: result.has_triple,
          is_straight: result.is_straight,
          sum_size: result.sum_size,
          sum_parity: result.sum_parity
        },
        time: result.time,
        created_at: result.created_at
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
    await redisClient.quit();
  }
}

checkActualResults(); 
module.exports = { setRedisHelper };
