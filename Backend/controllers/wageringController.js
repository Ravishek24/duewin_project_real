// Backend/controllers/wageringController.js
const { getModels } = require('../models');

/**
 * Get user wagering details and withdrawal eligibility
 */
const getUserWageringDetails = async (userId) => {
    try {
        const models = await getModels();
        const user = await models.User.findByPk(userId, {
            attributes: [
                'user_id',
                'user_name',
                'wallet_balance',
                'actual_deposit_amount',
                'total_external_credits',
                'total_self_rebate_credits',
                'current_wagering_requirement',
                'wagering_progress',
                'total_bet_amount',
                'last_external_credit_at'
            ]
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        const actualDeposit = parseFloat(user.actual_deposit_amount || 0);
        const externalCredits = parseFloat(user.total_external_credits || 0);
        const selfRebateCredits = parseFloat(user.total_self_rebate_credits || 0);
        const totalBetAmount = parseFloat(user.total_bet_amount || 0);
        const currentWageringReq = parseFloat(user.current_wagering_requirement || 0);
        const wageringProgress = parseFloat(user.wagering_progress || 0);

        // Calculate wagering requirement
        const wageringRequired = Math.max(actualDeposit, externalCredits);
        
        // Check if wagering is met
        const isWageringMet = totalBetAmount >= wageringRequired;
        const remainingWagering = Math.max(0, wageringRequired - totalBetAmount);
        const wageringPercentage = wageringRequired > 0 ? Math.min(100, (totalBetAmount / wageringRequired) * 100) : 0;

        // Get recent credit transactions
        const recentCredits = await models.CreditTransaction.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit: 10,
            attributes: [
                'credit_id',
                'amount',
                'credit_type',
                'source',
                'is_external_credit',
                'description',
                'created_at'
            ]
        });

        // Get recent betting activity
        const recentBets = await models.sequelize.query(`
            SELECT 
                'wingo' as game_type,
                bet_amount,
                created_at
            FROM bet_record_wingos 
            WHERE user_id = :userId AND status IN ('won', 'lost')
            UNION ALL
            SELECT 
                '5d' as game_type,
                bet_amount,
                created_at
            FROM bet_record_5ds 
            WHERE user_id = :userId AND status IN ('won', 'lost')
            UNION ALL
            SELECT 
                'k3' as game_type,
                bet_amount,
                created_at
            FROM bet_record_k3s 
            WHERE user_id = :userId AND status IN ('won', 'lost')
            UNION ALL
            SELECT 
                'trx_wix' as game_type,
                bet_amount,
                created_at
            FROM bet_record_trx_wix 
            WHERE user_id = :userId AND status IN ('won', 'lost')
            ORDER BY created_at DESC
            LIMIT 10
        `, {
            replacements: { userId },
            type: models.sequelize.QueryTypes.SELECT
        });

        // Get recent withdrawals
        const recentWithdrawals = await models.WalletWithdrawal.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit: 5,
            attributes: [
                'id',
                'amount',
                'status',
                'withdrawal_type',
                'wagering_status',
                'wagering_checked',
                'created_at'
            ]
        });

        return {
            success: true,
            data: {
                user_info: {
                    user_id: user.user_id,
                    user_name: user.user_name,
                    wallet_balance: user.wallet_balance
                },
                wagering_summary: {
                    actual_deposit_amount: actualDeposit,
                    total_external_credits: externalCredits,
                    total_self_rebate_credits: selfRebateCredits,
                    total_bet_amount: totalBetAmount,
                    current_wagering_requirement: currentWageringReq,
                    wagering_progress: wageringProgress
                },
                wagering_calculation: {
                    wagering_required: wageringRequired,
                    is_wagering_met: isWageringMet,
                    remaining_wagering: remainingWagering,
                    wagering_percentage: wageringPercentage.toFixed(2),
                    formula: `MAX(${actualDeposit}, ${externalCredits}) = ${wageringRequired}`,
                    bet_requirement: `${totalBetAmount} >= ${wageringRequired}`,
                    status: isWageringMet ? '✅ Wagering Complete' : '⏳ Wagering Pending'
                },
                withdrawal_eligibility: {
                    is_eligible: isWageringMet && parseFloat(user.wallet_balance) > 0,
                    reason: isWageringMet ? 'Wagering requirements met' : `Need to bet ₹${remainingWagering} more`,
                    can_withdraw: isWageringMet
                },
                recent_activity: {
                    credits: recentCredits,
                    bets: recentBets,
                    withdrawals: recentWithdrawals,
                    last_external_credit: user.last_external_credit_at
                }
            }
        };

    } catch (error) {
        console.error('❌ Error getting user wagering details:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * Check if user is eligible for withdrawal
 */
const checkWithdrawalEligibility = async (userId) => {
    try {
        const models = await getModels();
        const user = await models.User.findByPk(userId, {
            attributes: [
                'user_id',
                'user_name',
                'wallet_balance',
                'actual_deposit_amount',
                'total_external_credits',
                'total_self_rebate_credits',
                'current_wagering_requirement',
                'wagering_progress',
                'total_bet_amount'
            ]
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        const actualDeposit = parseFloat(user.actual_deposit_amount || 0);
        const externalCredits = parseFloat(user.total_external_credits || 0);
        const totalBetAmount = parseFloat(user.total_bet_amount || 0);
        const currentWageringReq = parseFloat(user.current_wagering_requirement || 0);
        const wageringProgress = parseFloat(user.wagering_progress || 0);

        // Calculate wagering requirement
        const wageringRequired = Math.max(actualDeposit, externalCredits);
        
        // Check if total bet amount meets wagering requirement
        const isWageringMet = totalBetAmount >= wageringRequired;
        
        // Calculate remaining wagering needed
        const remainingWagering = Math.max(0, wageringRequired - totalBetAmount);

        // Check if user has sufficient balance
        const hasSufficientBalance = parseFloat(user.wallet_balance) > 0;

        // User is eligible if:
        // 1. Has sufficient balance
        // 2. Wagering requirement is met
        const isEligible = hasSufficientBalance && isWageringMet;

        return {
            success: true,
            data: {
                user_id: user.user_id,
                user_name: user.user_name,
                wallet_balance: user.wallet_balance,
                actual_deposit_amount: actualDeposit,
                total_external_credits: externalCredits,
                total_self_rebate_credits: parseFloat(user.total_self_rebate_credits || 0),
                total_bet_amount: totalBetAmount,
                current_wagering_requirement: currentWageringReq,
                wagering_progress: wageringProgress,
                wagering_required: wageringRequired,
                remaining_wagering: remainingWagering,
                is_wagering_met: isWageringMet,
                has_sufficient_balance: hasSufficientBalance,
                is_eligible_for_withdrawal: isEligible,
                wagering_formula: `MAX(${actualDeposit}, ${externalCredits}) = ${wageringRequired}`,
                bet_requirement: `${totalBetAmount} >= ${wageringRequired}`,
                can_withdraw: isEligible
            }
        };
    } catch (error) {
        console.error('❌ Error checking withdrawal eligibility:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

module.exports = {
    getUserWageringDetails,
    checkWithdrawalEligibility
};
