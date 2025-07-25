// Backend/scripts/manualVipRewardPayout.js
const { getSequelizeInstance } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const models = require('../models');

(async () => {
  await models.initializeModels();
  const VipReward = models.VipReward;
  const User = models.User;
  const VipLevel = models.VipLevel;
  const Transaction = models.Transaction;

  const sequelize = await getSequelizeInstance();
  const t = await sequelize.transaction();
  const summary = [];
  try {
    // 1. Process all pending VIP level-up rewards
    const pendingLevelUp = await VipReward.findAll({
      where: { reward_type: 'level_up', status: 'pending' },
      include: [{ model: User, as: 'viprewarduser', attributes: ['user_id', 'user_name', 'vip_level'] }],
      transaction: t
    });
    for (const reward of pendingLevelUp) {
      const user = reward.viprewarduser;
      if (!user) continue;
      await User.increment('wallet_balance', { by: reward.amount, where: { user_id: user.user_id }, transaction: t });
      await reward.update({ status: 'completed', processed_at: new Date() }, { transaction: t });
      await Transaction.create({
        user_id: user.user_id,
        type: 'vip_reward',
        amount: reward.amount,
        status: 'completed',
        description: `VIP Level ${reward.level} upgrade bonus`,
        reference_id: `manual_vip_levelup_${reward.id}_${Date.now()}`,
        metadata: { vip_level: reward.level, reward_type: 'level_up' }
      }, { transaction: t });
      summary.push({ user_id: user.user_id, user_name: user.user_name, reward_type: 'level_up', level: reward.level, amount: reward.amount });
    }

    // 2. Process monthly VIP rewards for all eligible users (if not already claimed this month)
    const currentMonth = moment.tz('Asia/Kolkata').format('YYYY-MM');
    const vipUsers = await User.findAll({ where: { vip_level: { [Op.gt]: 0 } }, attributes: ['user_id', 'user_name', 'vip_level'], transaction: t });
    for (const user of vipUsers) {
      // Check if already claimed this month
      const existing = await VipReward.findOne({
        where: {
          user_id: user.user_id,
          level: user.vip_level,
          reward_type: 'monthly',
          created_at: { [Op.gte]: moment.tz('Asia/Kolkata').startOf('month').toDate() }
        },
        transaction: t
      });
      if (existing) continue;
      const vipLevel = await VipLevel.findOne({ where: { level: user.vip_level }, transaction: t });
      if (!vipLevel || parseFloat(vipLevel.monthly_reward) <= 0) continue;
      const monthlyReward = parseFloat(vipLevel.monthly_reward);
      await VipReward.create({
        user_id: user.user_id,
        level: user.vip_level,
        reward_type: 'monthly',
        amount: monthlyReward,
        status: 'completed'
      }, { transaction: t });
      await User.increment('wallet_balance', { by: monthlyReward, where: { user_id: user.user_id }, transaction: t });
      await Transaction.create({
        user_id: user.user_id,
        type: 'vip_reward',
        amount: monthlyReward,
        status: 'completed',
        description: `VIP Level ${user.vip_level} monthly reward - ${currentMonth}`,
        reference_id: `manual_vip_monthly_${user.user_id}_${currentMonth}`,
        metadata: { vip_level: user.vip_level, reward_type: 'monthly', month: currentMonth }
      }, { transaction: t });
      summary.push({ user_id: user.user_id, user_name: user.user_name, reward_type: 'monthly', level: user.vip_level, amount: monthlyReward });
    }

    await t.commit();
    // Print summary table
    console.log('\nVIP Reward Payout Summary:');
    console.log('--------------------------------------------------------------');
    console.log('| User ID | User Name         | Reward Type | Level | Amount   |');
    console.log('--------------------------------------------------------------');
    for (const row of summary) {
      console.log(`| ${row.user_id.toString().padEnd(7)} | ${row.user_name.padEnd(17)} | ${row.reward_type.padEnd(11)} | ${row.level.toString().padEnd(5)} | ${Number(row.amount).toFixed(2).padEnd(8)} |`);
    }
    console.log('--------------------------------------------------------------');

    process.exit(0);
  } catch (err) {
    console.error('Error processing manual VIP rewards:', err);
    process.exit(1);
  }
})();