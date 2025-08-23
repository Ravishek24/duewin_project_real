const { Op } = require('sequelize');
const { getModels } = require('../../models');

// Normalize a bet row into a unified response shape
function normalizeBetRow(row, gameType) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    betId: json.bet_id,
    userId: json.user_id,
    gameType,
    periodId: json.bet_number,
    duration: typeof json.duration === 'number' ? json.duration : null,
    bet: {
      type: json.bet_type,
      odds: Number(json.odds),
      amount: Number(json.bet_amount),
      taxAmount: Number(json.tax_amount || 0),
      amountAfterTax: Number(json.amount_after_tax || json.bet_amount)
    },
    status: json.status,
    winAmount: Number(json.win_amount || 0),
    payout: Number(json.payout || 0),
    result: json.result || null,
    wallet: {
      before: Number(json.wallet_balance_before || 0),
      after: Number(json.wallet_balance_after || 0)
    },
    createdAt: json.created_at,
    updatedAt: json.updated_at,
    user: json.user ? { userId: json.user.user_id, userName: json.user.user_name } : null
  };
}

// Build where clause based on filters
function buildWhere(periodId, duration, status, userId) {
  const where = { bet_number: periodId };
  if (duration !== undefined && duration !== null) {
    where.duration = duration;
  }
  if (status) {
    where.status = status;
  }
  if (userId) {
    where.user_id = userId;
  }
  return where;
}

// GET /api/admin/games/period-bets
// Query: periodId (required), duration (required), gameType (optional: wingo|k3|5d|trx_wix), status (optional), userId (optional), page, limit
async function getPeriodBetsController(req, res) {
  try {
    const periodId = String(req.query.periodId || '').trim();
    const durationParam = req.query.duration;
    const duration = durationParam !== undefined ? parseInt(durationParam, 10) : undefined;
    const gameType = req.query.gameType ? String(req.query.gameType).toLowerCase() : undefined;
    const status = req.query.status ? String(req.query.status).toLowerCase() : undefined; // pending|won|lost
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : undefined;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    if (!periodId) {
      return res.status(400).json({ success: false, message: 'periodId is required' });
    }
    if (!Number.isInteger(duration)) {
      return res.status(400).json({ success: false, message: 'duration is required and must be an integer' });
    }

    const models = await getModels();
    const includeUser = [{ model: models.User, as: 'user', attributes: ['user_id', 'user_name'] }];
    const attributes = [
      'bet_id', 'user_id', 'bet_number', 'bet_type', 'bet_amount', 'tax_amount', 'amount_after_tax', 'odds', 'status',
      'win_amount', 'payout', 'result', 'wallet_balance_before', 'wallet_balance_after', 'duration', 'created_at', 'updated_at'
    ];
    const where = buildWhere(periodId, duration, status, userId);

    const queries = [];
    const modelMap = {
      wingo: { model: models.BetRecordWingo, type: 'wingo' },
      k3: { model: models.BetRecordK3, type: 'k3' },
      '5d': { model: models.BetRecord5D, type: '5d' },
      trx_wix: { model: models.BetRecordTrxWix, type: 'trx_wix' }
    };

    if (gameType) {
      const entry = modelMap[gameType];
      if (!entry || !entry.model) {
        return res.status(400).json({ success: false, message: 'Invalid gameType. Use wingo|k3|5d|trx_wix' });
      }
      queries.push({ entry, promise: entry.model.findAndCountAll({ where, include: includeUser, attributes, limit, offset, order: [['created_at', 'DESC']] }) });
    } else {
      for (const key of Object.keys(modelMap)) {
        const entry = modelMap[key];
        if (entry && entry.model) {
          queries.push({ entry, promise: entry.model.findAndCountAll({ where, include: includeUser, attributes, limit, offset, order: [['created_at', 'DESC']] }) });
        }
      }
    }

    // Execute all queries in parallel
    const results = await Promise.all(queries.map(q => q.promise));

    // Merge rows with type tagging and compute summary
    let rows = [];
    let totalAcross = 0;
    const byGameType = {};

    for (let i = 0; i < results.length; i++) {
      const { entry } = queries[i];
      const { count, rows: modelRows } = results[i];
      totalAcross += typeof count === 'number' ? count : (count?.length || 0);

      const normalized = modelRows.map(r => normalizeBetRow(r, entry.type));
      rows = rows.concat(normalized);

      // Aggregate per gameType (based on the returned chunk only)
      if (!byGameType[entry.type]) {
        byGameType[entry.type] = { totalBets: 0, totalBetAmount: 0, totalWins: 0, totalWinAmount: 0 };
      }
      for (const n of normalized) {
        byGameType[entry.type].totalBets += 1;
        byGameType[entry.type].totalBetAmount += n.bet.amount;
        if (n.status === 'won') {
          byGameType[entry.type].totalWins += 1;
          byGameType[entry.type].totalWinAmount += n.winAmount;
        }
      }
    }

    // Sort merged rows by created_at desc
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Re-apply page slicing in case multiple tables contributed
    const pagedRows = rows.slice(0, limit);

    // Compute global summary
    const summary = {
      totalBets: totalAcross, // total matching rows across tables (unpaged)
      totalBetAmount: rows.reduce((s, r) => s + r.bet.amount, 0),
      totalWins: rows.filter(r => r.status === 'won').length,
      totalWinAmount: rows.reduce((s, r) => s + (r.status === 'won' ? r.winAmount : 0), 0),
    };
    summary.netProfitLoss = Number((summary.totalBetAmount - summary.totalWinAmount).toFixed(2));

    return res.status(200).json({
      success: true,
      filters: { periodId, duration, gameType: gameType || 'all', status: status || null, userId: userId || null },
      summary: {
        ...summary,
        byGameType: Object.fromEntries(Object.entries(byGameType).map(([k, v]) => [k, {
          ...v,
          netProfitLoss: Number((v.totalBetAmount - v.totalWinAmount).toFixed(2))
        }]))
      },
      pagination: {
        page,
        limit,
        total: totalAcross,
        pages: Math.max(1, Math.ceil(totalAcross / limit)),
        hasNext: totalAcross > page * limit,
        hasPrev: page > 1
      },
      data: pagedRows
    });
  } catch (error) {
    console.error('Error fetching period bets:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch period bets' });
  }
}

module.exports = {
  getPeriodBetsController
};


