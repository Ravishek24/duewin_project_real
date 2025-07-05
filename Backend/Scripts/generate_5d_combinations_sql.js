const fs = require("fs");
const path = require("path");

const BATCH_SIZE = 1000;
const OUTPUT_FILE = path.join(__dirname, "insert_game_combinations_5d.sql");
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

  return JSON.stringify({
    positions,
    sum: {
      value: `SUM:${sum}`,
      size: `SUM_SIZE:${sumSize}`,
      parity: `SUM_PARITY:${sumParity}`
    }
  });
}

function formatRow(dice) {
  const diceValue = parseInt(dice.join(''));
  const sum = dice.reduce((a, b) => a + b, 0);
  const sumSize = getSumType(sum);
  const sumParity = getSumParity(sum);
  const positionFlags = getPositionFlags(dice);
  const winningConditions = buildWinningConditions(dice, sum, sumSize, sumParity);

  return `(${diceValue}, ${dice[0]}, ${dice[1]}, ${dice[2]}, ${dice[3]}, ${dice[4]}, ` +
         `'${sumSize}', '${sumParity}', ${positionFlags}, 0, '${winningConditions.replace(/'/g, "\\'")}')`;
}

async function generateAndWrite() {
  const stream = fs.createWriteStream(OUTPUT_FILE, { flags: 'w' });
  stream.write("-- Generated INSERT script for game_combinations_5d\n");
  stream.write("TRUNCATE TABLE game_combinations_5d;\n\n");

  let count = 0;
  let buffer = [];

  // Write the first INSERT header
  stream.write("INSERT INTO game_combinations_5d\n");
  stream.write("(dice_value, dice_a, dice_b, dice_c, dice_d, dice_e, sum_size, sum_parity, position_flags, estimated_exposure_score, winning_conditions)\nVALUES\n");

  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      for (let c = 0; c <= 9; c++) {
        for (let d = 0; d <= 9; d++) {
          for (let e = 0; e <= 9; e++) {
            const row = formatRow([a, b, c, d, e]);
            buffer.push(row);
            count++;

            if (buffer.length === BATCH_SIZE) {
              stream.write(buffer.join(",\n") + ";\n\n");
              buffer = [];
              // Only write a new INSERT header if this is not the last row
              if (count < TOTAL_ROWS) {
                stream.write("INSERT INTO game_combinations_5d\n" +
                  "(dice_value, dice_a, dice_b, dice_c, dice_d, dice_e, sum_size, sum_parity, position_flags, estimated_exposure_score, winning_conditions)\nVALUES\n");
              }
            }
          }
        }
      }
    }
  }

  // Write any remaining rows (final batch)
  if (buffer.length > 0) {
    stream.write(buffer.join(",\n") + ";\n");
  }

  stream.end();
  console.log(`✅ Finished generating ${count} combinations into ${OUTPUT_FILE}`);
}

generateAndWrite(); 