// Backend/scripts/testDailyRebatePayout.js
const { getDatabaseInstances } = require('./masterCronJobs');
const moment = require('moment-timezone');

(async () => {
  const { sequelize: db, models: dbModels } = await getDatabaseInstances();
  const Op = db.Sequelize.Op;
  const t = await db.transaction();
  try {
    const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').startOf('day').toDate();
    const endOfYesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').endOf('day').toDate();
    for (const gameType of ['lottery', 'casino']) {
      let betRecords;
      if (gameType === 'lottery') {
        betRecords = await db.query(`
          SELECT user_id, SUM(bet_amount) as total_bet_amount
          FROM (
            SELECT user_id, bet_amount FROM bet_record_wingos 
            WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
            UNION ALL
            SELECT user_id, bet_amount FROM bet_record_5ds
            WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
            UNION ALL
            SELECT user_id, bet_amount FROM bet_record_k3s
            WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
            UNION ALL
            SELECT user_id, bet_amount FROM bet_record_trx_wix
            WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
          ) as combined_bets
          GROUP BY user_id
          HAVING total_bet_amount > 0
        `, {
          replacements: { start: yesterday, end: endOfYesterday },
          type: db.QueryTypes.SELECT,
          transaction: t
        });
      } else if (gameType === 'casino') {
        betRecords = await db.query(`
          SELECT user_id, SUM(amount) as total_bet_amount
          FROM seamless_transactions
          WHERE type = 'debit' AND created_at BETWEEN :start AND :end
          GROUP BY user_id
          HAVING total_bet_amount > 0
        `, {
          replacements: { start: yesterday, end: endOfYesterday },
          type: db.QueryTypes.SELECT,
          transaction: t
        });
      }
      console.log(`\n=== ${gameType.toUpperCase()} REBATE TEST ===`);
      console.log(`Found ${betRecords.length} users with bets yesterday`);
      const userIds = betRecords.map(r => r.user_id);
      const users = await dbModels.User.findAll({ where: { user_id: { [Op.in]: userIds } }, attributes: ['user_id', 'user_name', 'referral_code'], transaction: t });
      const userMap = new Map(users.map(u => [u.user_id, u]));
      const referralCodes = [...new Set(users.map(u => u.referral_code).filter(Boolean))];
      const referrers = await dbModels.User.findAll({
        where: { referring_code: { [Op.in]: referralCodes } },
        attributes: ['user_id', 'user_name', 'referring_code'],
        include: [{
          model: dbModels.UserRebateLevel,
          required: false,
          as: 'userrebateleveluser',
          attributes: ['rebate_level_id'],
          include: [{
            model: dbModels.RebateLevel,
            as: 'level',
            attributes: ['id', 'level', 'lottery_l1_rebate', 'casino_l1_rebate']
          }]
        }],
        transaction: t
      });
      const referrerMap = new Map(referrers.map(r => [r.referring_code, r]));
      const rebateLevels = await dbModels.RebateLevel.findAll({ attributes: ['level', 'lottery_l1_rebate', 'casino_l1_rebate'], transaction: t });
      const rebateLevelMap = new Map(rebateLevels.map(l => [l.level, l]));
      let processed = 0, totalCommission = 0;
      // Add a map to accumulate commission per referrer per user
      const referrerSummary = new Map();
      for (const record of betRecords) {
        const userId = record.user_id;
        const betAmount = parseFloat(record.total_bet_amount);
        const user = userMap.get(userId);
        if (!user || !user.referral_code) continue;
        const referrer = referrerMap.get(user.referral_code);
        if (!referrer) continue;
        const rebateLevelDetails = referrer.userrebateleveluser?.level;
        const rebateLevel = rebateLevelDetails?.level || 'L0';
        if (!rebateLevelDetails) continue;
        const rate = gameType === 'lottery' ? parseFloat(rebateLevelDetails.lottery_l1_rebate) / 100 : parseFloat(rebateLevelDetails.casino_l1_rebate) / 100;
        const commission = betAmount * rate;
        if (commission > 0) {
          processed++;
          totalCommission += commission;
          console.log(`Referrer: ${referrer.user_name} (ID: ${referrer.user_id}) [Rebate Level: ${rebateLevel}] gets ${commission.toFixed(2)} from user ${user.user_name} (ID: ${userId}), Bet: ${betAmount.toFixed(2)}, Rate: ${(rate*100).toFixed(2)}%`);
          if (!referrerSummary.has(referrer.user_id)) {
            referrerSummary.set(referrer.user_id, {
              referrerName: referrer.user_name,
              rebateLevel,
              total: 0,
              fromUsers: []
            });
          }
          const refSum = referrerSummary.get(referrer.user_id);
          refSum.total += commission;
          refSum.fromUsers.push({
            userId,
            userName: user.user_name,
            commission
          });
        }
      }
      console.log(`Total processed: ${processed}, Total commission: ${totalCommission.toFixed(2)}`);
      // Print summary per referrer
      for (const [refId, refSum] of referrerSummary.entries()) {
        console.log(`\nReferrer: ${refSum.referrerName} (ID: ${refId}) [Rebate Level: ${refSum.rebateLevel}]`);
        console.log(`  Total commission: ${refSum.total.toFixed(2)}`);
        for (const u of refSum.fromUsers) {
          console.log(`    From user ${u.userName} (ID: ${u.userId}): ${u.commission.toFixed(2)}`);
        }
      }
    }
    await t.rollback(); // Dry run, do not commit
    process.exit(0);
  } catch (err) {
    await t.rollback();
    console.error('Error testing daily rebate payout:', err);
    process.exit(1);
  }
})(); 