/**
 * Process bet for activity reward
 * @param {number} userId - User ID
 * @param {number} betAmount - Bet amount
 * @param {string} gameType - Type of game (wingo, 5d, k3, trx_wix, seamless, spribe)
 * @param {object} transaction - Optional transaction object
 */
const processBetForActivityReward = async (userId, betAmount, gameType, transaction = null) => {
    try {
        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        
        // Get or create activity record for today
        let activityRecord = await ActivityReward.findOne({
            where: {
                user_id: userId,
                date: today
            },
            transaction
        });

        if (!activityRecord) {
            activityRecord = await ActivityReward.create({
                user_id: userId,
                date: today,
                lottery_bet_amount: 0,
                all_games_bet_amount: 0,
                claimed_milestones: [],
                total_rewards: 0
            }, { transaction });
        }

        // Update bet amounts
        const isLotteryGame = ['wingo', '5d', 'k3', 'trx_wix'].includes(gameType);
        
        if (isLotteryGame) {
            await activityRecord.update({
                lottery_bet_amount: activityRecord.lottery_bet_amount + betAmount,
                all_games_bet_amount: activityRecord.all_games_bet_amount + betAmount
            }, { transaction });
        } else {
            // For seamless, spribe, and other games
            await activityRecord.update({
                all_games_bet_amount: activityRecord.all_games_bet_amount + betAmount
            }, { transaction });
        }

        // Check and process milestones
        await checkAndProcessMilestones(userId, activityRecord, transaction);

        return {
            success: true,
            message: 'Activity reward processed successfully'
        };
    } catch (error) {
        logger.error('Error processing activity reward:', {
            error: error.message,
            userId,
            betAmount,
            gameType
        });
        throw error;
    }
}; 