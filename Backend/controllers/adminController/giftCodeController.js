const { GiftCode, GiftCodeClaim, User } = require('../../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

// Admin: Create a new gift code
toFixed2 = n => Number.parseFloat(n).toFixed(2);
const createGiftCode = async (req, res) => {
  try {
    const { number_of_users, total_amount } = req.body;
    if (!number_of_users || !total_amount || number_of_users <= 0 || total_amount <= 0) {
      return res.status(400).json({ success: false, message: 'number_of_users and total_amount must be positive.' });
    }
    const amount_per_user = toFixed2(total_amount / number_of_users);
    let code;
    // Ensure unique code
    do {
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
    } while (await GiftCode.findOne({ where: { code } }));
    const giftCode = await GiftCode.create({
      code,
      total_amount: toFixed2(total_amount),
      max_claims: number_of_users,
      claimed_count: 0,
      amount_per_user,
      created_by: req.user.user_id,
      created_at: new Date()
    });
    res.json({ success: true, code: giftCode.code, amount_per_user });
  } catch (error) {
    console.error('Error in createGiftCode:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: Get gift code status and claimants
const getGiftCodeStatus = async (req, res) => {
  try {
    const { code } = req.params;
    const giftCode = await GiftCode.findOne({ where: { code } });
    if (!giftCode) return res.status(404).json({ success: false, message: 'Gift code not found' });
    const claims = await GiftCodeClaim.findAll({ where: { gift_code_id: giftCode.id }, include: [{ model: User, attributes: ['user_id', 'user_name', 'email'] }] });
    res.json({
      success: true,
      code: giftCode.code,
      total_amount: giftCode.total_amount,
      max_claims: giftCode.max_claims,
      claimed_count: giftCode.claimed_count,
      amount_per_user: giftCode.amount_per_user,
      created_by: giftCode.created_by,
      created_at: giftCode.created_at,
      claimants: claims.map(c => ({ user_id: c.user_id, user_name: c.User?.user_name, email: c.User?.email, claimed_at: c.claimed_at }))
    });
  } catch (error) {
    console.error('Error in getGiftCodeStatus:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// User: Claim a gift code
const claimGiftCode = async (req, res) => {
  try {
    const { code } = req.body;
    const user_id = req.user.user_id;
    const giftCode = await GiftCode.findOne({ where: { code } });
    if (!giftCode) return res.status(404).json({ success: false, message: 'Gift code not found' });
    if (giftCode.claimed_count >= giftCode.max_claims) return res.status(400).json({ success: false, message: 'Gift code fully claimed' });
    const alreadyClaimed = await GiftCodeClaim.findOne({ where: { gift_code_id: giftCode.id, user_id } });
    if (alreadyClaimed) return res.status(400).json({ success: false, message: 'You have already claimed this code' });
    // Credit main wallet
    const user = await User.findByPk(user_id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.wallet_balance = Number(user.wallet_balance) + Number(giftCode.amount_per_user);
    await user.save();
    // Record claim
    await GiftCodeClaim.create({ gift_code_id: giftCode.id, user_id, claimed_at: new Date() });
    // Update claimed_count
    giftCode.claimed_count += 1;
    await giftCode.save();
    res.json({ success: true, message: 'Gift claimed successfully', amount: giftCode.amount_per_user });
  } catch (error) {
    console.error('Error in claimGiftCode:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { createGiftCode, getGiftCodeStatus, claimGiftCode }; 