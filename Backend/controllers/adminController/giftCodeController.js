const { Op } = require('sequelize');
const { sequelize } = require('../../config/db');
const crypto = require('crypto');

// Initialize models properly
let GiftCode, GiftCodeClaim, User;

const initializeModels = async () => {
  try {
    console.log('🔧 Initializing gift code models...');
    
    // Try the getModels approach first
    try {
      const { getModels } = require('../../models');
      const models = await getModels();
      
      console.log('📊 Available models:', Object.keys(models));
      
      GiftCode = models.GiftCode;
      GiftCodeClaim = models.GiftCodeClaim;
      User = models.User;
      
      console.log('🎁 GiftCode model:', GiftCode ? 'Loaded' : 'NOT LOADED');
      console.log('🎁 GiftCodeClaim model:', GiftCodeClaim ? 'Loaded' : 'NOT LOADED');
      console.log('👤 User model:', User ? 'Loaded' : 'NOT LOADED');
      
      // Verify models are loaded
      if (!GiftCode || !GiftCodeClaim || !User) {
        throw new Error('Required models not loaded: GiftCode, GiftCodeClaim, or User');
      }
      
      console.log('✅ Gift code models initialized successfully');
      return;
    } catch (getModelsError) {
      console.log('⚠️ getModels approach failed, trying direct import...');
    }
    
    // Fallback: Try direct import
    try {
      const models = require('../../models');
      GiftCode = models.GiftCode;
      GiftCodeClaim = models.GiftCodeClaim;
      User = models.User;
      
      console.log('🎁 GiftCode model (direct):', GiftCode ? 'Loaded' : 'NOT LOADED');
      console.log('🎁 GiftCodeClaim model (direct):', GiftCodeClaim ? 'Loaded' : 'NOT LOADED');
      console.log('👤 User model (direct):', User ? 'Loaded' : 'NOT LOADED');
      
      // Verify models are loaded
      if (!GiftCode || !GiftCodeClaim || !User) {
        throw new Error('Required models not loaded with direct import');
      }
      
      console.log('✅ Gift code models initialized successfully (direct import)');
      return;
    } catch (directImportError) {
      console.log('⚠️ Direct import approach failed, trying individual imports...');
    }
    
    // Final fallback: Try individual imports
    try {
      GiftCode = require('../../models/GiftCode');
      GiftCodeClaim = require('../../models/GiftCodeClaim');
      User = require('../../models/User');
      
      console.log('🎁 GiftCode model (individual):', GiftCode ? 'Loaded' : 'NOT LOADED');
      console.log('🎁 GiftCodeClaim model (individual):', GiftCodeClaim ? 'Loaded' : 'NOT LOADED');
      console.log('👤 User model (individual):', User ? 'Loaded' : 'NOT LOADED');
      
      // Verify models are loaded
      if (!GiftCode || !GiftCodeClaim || !User) {
        throw new Error('Required models not loaded with individual imports');
      }
      
      console.log('✅ Gift code models initialized successfully (individual imports)');
      return;
    } catch (individualImportError) {
      throw new Error(`All model import approaches failed: ${individualImportError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error initializing gift code models:', error);
    throw error;
  }
};

// Admin: Create a new gift code
toFixed2 = n => Number.parseFloat(n).toFixed(2);
const createGiftCode = async (req, res) => {
  try {
    await initializeModels();
    
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

// Admin: Get gift code by code
const getGiftCodeByCode = async (req, res) => {
  try {
    await initializeModels();
    
    const { code } = req.params;
    const giftCode = await GiftCode.findOne({ where: { code } });
    if (!giftCode) return res.status(404).json({ success: false, message: 'Gift code not found' });
    
    const claims = await GiftCodeClaim.findAll({ 
      where: { gift_code_id: giftCode.id }, 
      include: [{ 
        model: User, 
        as: 'giftcodeclaimuser', 
        attributes: ['user_id', 'user_name', 'phone_no'] 
      }] 
    });
    
    res.json({
      success: true,
      data: {
        id: giftCode.id,
        code: giftCode.code,
        total_amount: giftCode.total_amount,
        max_claims: giftCode.max_claims,
        claimed_count: giftCode.claimed_count,
        amount_per_user: giftCode.amount_per_user,
        created_by: giftCode.created_by,
        created_at: giftCode.created_at,
        status: giftCode.claimed_count >= giftCode.max_claims ? 'completed' : 'active',
        remaining_claims: Math.max(0, giftCode.max_claims - giftCode.claimed_count),
        claimants: claims.map(c => ({ 
          user_id: c.user_id, 
          user_name: c.giftcodeclaimuser?.user_name, 
          phone_no: c.giftcodeclaimuser?.phone_no, 
          claimed_at: c.claimed_at,
          claimed_ip: c.claimed_ip
        }))
      }
    });
  } catch (error) {
    console.error('Error in getGiftCodeByCode:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: Get gift code status and claimants
const getGiftCodeStatus = async (req, res) => {
  try {
    await initializeModels();
    
    const { code } = req.params;
    const giftCode = await GiftCode.findOne({ where: { code } });
    if (!giftCode) return res.status(404).json({ success: false, message: 'Gift code not found' });
    const claims = await GiftCodeClaim.findAll({ where: { gift_code_id: giftCode.id }, include: [{ model: User, as: 'giftcodeclaimuser', attributes: ['user_id', 'user_name', 'phone_no'] }] });
    res.json({
      success: true,
      code: giftCode.code,
      total_amount: giftCode.total_amount,
      max_claims: giftCode.max_claims,
      claimed_count: giftCode.claimed_count,
      amount_per_user: giftCode.amount_per_user,
      created_by: giftCode.created_by,
      created_at: giftCode.created_at,
      claimants: claims.map(c => ({ user_id: c.user_id, user_name: c.giftcodeclaimuser?.user_name, phone_no: c.giftcodeclaimuser?.phone_no, claimed_at: c.claimed_at, claimed_ip: c.claimed_ip }))
    });
  } catch (error) {
    console.error('Error in getGiftCodeStatus:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// User: Claim a gift code
const claimGiftCode = async (req, res) => {
  try {
    await initializeModels();
    
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
    // Record claim with IP address
    const claimed_ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    await GiftCodeClaim.create({ 
      gift_code_id: giftCode.id, 
      user_id, 
      claimed_at: new Date(),
      claimed_ip: claimed_ip
    });
    // Update claimed_count
    giftCode.claimed_count += 1;
    await giftCode.save();
    res.json({ success: true, message: 'Gift claimed successfully', amount: giftCode.amount_per_user });
  } catch (error) {
    console.error('Error in claimGiftCode:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// User: Get gift code claim history
const getUserGiftCodeHistory = async (req, res) => {
  try {
    await initializeModels();
    
    const user_id = req.user.user_id;
    const { page = 1, limit = 20, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause for date filtering
    const whereClause = { user_id };
    if (start_date || end_date) {
      whereClause.claimed_at = {};
      if (start_date) whereClause.claimed_at[Op.gte] = new Date(start_date);
      if (end_date) whereClause.claimed_at[Op.lte] = new Date(end_date + ' 23:59:59');
    }

    // Get user's gift code claims with gift code details
    const claims = await GiftCodeClaim.findAndCountAll({
      where: whereClause,
      include: [{
        model: GiftCode,
        as: 'giftCode',
        attributes: ['code', 'amount_per_user', 'total_amount', 'max_claims', 'created_at']
      }],
      order: [['claimed_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Calculate total amount claimed
    const totalAmountClaimed = claims.rows.reduce((sum, claim) => {
      return sum + parseFloat(claim.giftCode.amount_per_user);
    }, 0);

    res.json({
      success: true,
      data: {
        claims: claims.rows.map(claim => ({
          id: claim.id,
          gift_code: claim.giftCode.code,
          amount: claim.giftCode.amount_per_user,
          claimed_at: claim.claimed_at,
          claimed_ip: claim.claimed_ip,
          gift_code_details: {
            total_amount: claim.giftCode.total_amount,
            max_claims: claim.giftCode.max_claims,
            created_at: claim.giftCode.created_at
          }
        })),
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(claims.count / limit),
          total_records: claims.count,
          records_per_page: parseInt(limit)
        },
        summary: {
          total_claims: claims.count,
          total_amount_claimed: toFixed2(totalAmountClaimed)
        }
      }
    });
  } catch (error) {
    console.error('Error in getUserGiftCodeHistory:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: Get all gift codes with pagination and filtering
const getAllGiftCodes = async (req, res) => {
  try {
    await initializeModels();
    
    const { page = 1, limit = 20, status, start_date, end_date, search } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (status) {
      if (status === 'active') {
        whereClause.claimed_count = { [Op.lt]: sequelize.col('max_claims') };
      } else if (status === 'completed') {
        whereClause.claimed_count = { [Op.gte]: sequelize.col('max_claims') };
      }
    }
    if (start_date || end_date) {
      whereClause.created_at = {};
      if (start_date) whereClause.created_at[Op.gte] = new Date(start_date);
      if (end_date) whereClause.created_at[Op.lte] = new Date(end_date + ' 23:59:59');
    }
    if (search) {
      whereClause.code = { [Op.like]: `%${search}%` };
    }

    // Get gift codes with claim count
    const giftCodes = await GiftCode.findAndCountAll({
      where: whereClause,
      include: [{
        model: GiftCodeClaim,
        as: 'claims',
        include: [{
          model: User,
          as: 'giftcodeclaimuser',
          attributes: ['user_id', 'user_name', 'phone_no']
        }]
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Calculate statistics
    const totalAmount = giftCodes.rows.reduce((sum, gc) => sum + parseFloat(gc.total_amount), 0);
    const totalClaimed = giftCodes.rows.reduce((sum, gc) => sum + gc.claimed_count, 0);
    const totalClaims = giftCodes.rows.reduce((sum, gc) => sum + gc.claims.length, 0);

    res.json({
      success: true,
      data: {
        gift_codes: giftCodes.rows.map(gc => ({
          id: gc.id,
          code: gc.code,
          total_amount: gc.total_amount,
          max_claims: gc.max_claims,
          claimed_count: gc.claimed_count,
          amount_per_user: gc.amount_per_user,
          created_by: gc.created_by,
          created_at: gc.created_at,
          status: gc.claimed_count >= gc.max_claims ? 'completed' : 'active',
          claimants: gc.claims.map(claim => ({
            user_id: claim.giftcodeclaimuser.user_id,
            user_name: claim.giftcodeclaimuser.user_name,
            phone_no: claim.giftcodeclaimuser.phone_no,
            claimed_at: claim.claimed_at,
            claimed_ip: claim.claimed_ip
          }))
        })),
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(giftCodes.count / limit),
          total_records: giftCodes.count,
          records_per_page: parseInt(limit)
        },
        summary: {
          total_gift_codes: giftCodes.count,
          total_amount: toFixed2(totalAmount),
          total_claimed: totalClaimed,
          total_claims: totalClaims
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllGiftCodes:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: Get gift code statistics
const getGiftCodeStats = async (req, res) => {
  try {
    await initializeModels();
    
    const { start_date, end_date } = req.query;

    // Build date filter
    const dateFilter = {};
    if (start_date || end_date) {
      if (start_date) dateFilter[Op.gte] = new Date(start_date);
      if (end_date) dateFilter[Op.lte] = new Date(end_date + ' 23:59:59');
    }

    // Get statistics
    const totalGiftCodes = await GiftCode.count({ where: dateFilter });
    const activeGiftCodes = await GiftCode.count({
      where: {
        ...dateFilter,
        claimed_count: { [Op.lt]: sequelize.col('max_claims') }
      }
    });
    const completedGiftCodes = await GiftCode.count({
      where: {
        ...dateFilter,
        claimed_count: { [Op.gte]: sequelize.col('max_claims') }
      }
    });

    // Get total amounts
    const totalAmountResult = await GiftCode.sum('total_amount', { where: dateFilter });
    const totalAmount = totalAmountResult || 0;

    // Get total claims
    const totalClaims = await GiftCodeClaim.count({
      where: dateFilter,
      include: [{
        model: GiftCode,
        as: 'giftCode',
        where: dateFilter
      }]
    });

    // Get recent activity (last 10 claims)
    const recentClaims = await GiftCodeClaim.findAll({
      include: [
        {
          model: GiftCode,
          as: 'giftCode',
          attributes: ['code', 'amount_per_user']
        },
        {
          model: User,
          as: 'giftcodeclaimuser',
          attributes: ['user_id', 'user_name']
        }
      ],
      order: [['claimed_at', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      data: {
        overview: {
          total_gift_codes: totalGiftCodes,
          active_gift_codes: activeGiftCodes,
          completed_gift_codes: completedGiftCodes,
          total_amount: toFixed2(totalAmount),
          total_claims: totalClaims
        },
        recent_activity: recentClaims.map(claim => ({
          gift_code: claim.giftCode.code,
          user_name: claim.giftcodeclaimuser.user_name,
          amount: claim.giftCode.amount_per_user,
          claimed_at: claim.claimed_at,
          claimed_ip: claim.claimed_ip
        }))
      }
    });
  } catch (error) {
    console.error('Error in getGiftCodeStats:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { 
  createGiftCode, 
  getGiftCodeByCode,
  getGiftCodeStatus, 
  claimGiftCode, 
  getUserGiftCodeHistory, 
  getAllGiftCodes, 
  getGiftCodeStats 
}; 