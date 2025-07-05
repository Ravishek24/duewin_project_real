const { getModels } = require('../models');

const BATCH_SIZE = 1000;
const TOTAL_ROWS = 10 * 10 * 10 * 10 * 10; // 100,000

const isBig = (n) => n >= 5 ? 1 : 0;
const isOdd = (n) => n % 2 === 1 ? 1 : 0;

function getSumType(sum) {
  return sum >= 22 ? 'big' : 'small';
}

function getSumParity(sum) {
  return sum % 2 === 0 ? 'even' : 'odd';
}

function getPositionFlags(dice) {
  let flag = 0;
  dice.forEach((val, i) => {
    const bigBit = isBig(val) << i;       // bits 0-4
    const oddBit = isOdd(val) << (i + 5); // bits 5-9
    flag |= bigBit | oddBit;
  });
  return flag;
}

function buildWinningConditions(dice, sum, sumSize, sumParity) {
  const positions = {
    exact: [],
    size: [],
    parity: []
  };

  ['A', 'B', 'C', 'D', 'E'].forEach((label, i) => {
    positions.exact.push(`POSITION:${label}_${dice[i]}`);
    positions.size.push(`POSITION_SIZE:${label}_${isBig(dice[i]) ? 'big' : 'small'}`);
    positions.parity.push(`POSITION_PARITY:${label}_${isOdd(dice[i]) ? 'odd' : 'even'}`);
  });

  return {
    positions,
    sum: {
      value: `SUM:${sum}`,
      size: `SUM_SIZE:${sumSize}`,
      parity: `SUM_PARITY:${sumParity}`
    }
  };
}

function formatRow(dice) {
  const diceValue = parseInt(dice.join(''));
  const sum = dice.reduce((a, b) => a + b, 0);
  const sumSize = getSumType(sum);
  const sumParity = getSumParity(sum);
  const positionFlags = getPositionFlags(dice);
  const winningConditions = buildWinningConditions(dice, sum, sumSize, sumParity);

  return {
    dice_value: diceValue,
    dice_a: dice[0],
    dice_b: dice[1],
    dice_c: dice[2],
    dice_d: dice[3],
    dice_e: dice[4],
    sum_size: sumSize,
    sum_parity: sumParity,
    position_flags: positionFlags,
    estimated_exposure_score: 0,
    winning_conditions: winningConditions
  };
}

async function main() {
  const models = await getModels();
  const GameCombinations5D = models.GameCombinations5D;

  // Truncate table
  await GameCombinations5D.destroy({ where: {}, truncate: true });
  console.log('Table truncated.');

  let buffer = [];
  let count = 0;
  let batchNum = 1;

  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      for (let c = 0; c <= 9; c++) {
        for (let d = 0; d <= 9; d++) {
          for (let e = 0; e <= 9; e++) {
            buffer.push(formatRow([a, b, c, d, e]));
            count++;
            if (buffer.length === BATCH_SIZE) {
              try {
                await GameCombinations5D.bulkCreate(buffer);
                console.log(`Batch ${batchNum++}: Inserted ${buffer.length} rows (total: ${count})`);
              } catch (err) {
                console.error(`Error in batch ${batchNum}:`, err.message);
                process.exit(1);
              }
              buffer = [];
            }
          }
        }
      }
    }
  }
  if (buffer.length > 0) {
    try {
      await GameCombinations5D.bulkCreate(buffer);
      console.log(`Final batch: Inserted ${buffer.length} rows (total: ${count})`);
    } catch (err) {
      console.error('Error in final batch:', err.message);
      process.exit(1);
    }
  }
  console.log('✅ All combinations inserted successfully!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 