// Claim level up reward
router.post('/claim-level-reward', auth, async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['user_id', 'vip_level', 'wallet_balance'],
            transaction: t
        });

        if (!user) {
            await t.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        const currentLevel = await VipLevel.findOne({
            where: { level: user.vip_level },
            transaction: t
        });

        if (!currentLevel) {
            await t.rollback();
            return res.status(404).json({ message: 'VIP level not found' });
        }

        // Check if reward already claimed
        const existingReward = await VipReward.findOne({
            where: {
                user_id: user.id,
                level: currentLevel.level,
                reward_type: 'level_up'
            },
            transaction: t
        });

        if (existingReward) {
            await t.rollback();
            return res.status(400).json({ message: 'Level up reward already claimed' });
        }

        // Create reward record
        await VipReward.create({
            user_id: user.id,
            level: currentLevel.level,
            reward_type: 'level_up',
            amount: currentLevel.bonus_amount,
            claimed_at: new Date()
        }, { transaction: t });

        // Update wallet balance
        await User.update(
            {
                wallet_balance: sequelize.literal(`wallet_balance + ${currentLevel.bonus_amount}`)
            },
            {
                where: { user_id: user.id },
                transaction: t
            }
        );

        // Log transaction
        await sequelize.query(
            `INSERT INTO transactions (user_id, amount, type, note, created_at)
             VALUES (:userId, :amount, 'credit', 'VIP level up reward', NOW())`,
            {
                replacements: {
                    userId: user.id,
                    amount: currentLevel.bonus_amount
                },
                type: sequelize.QueryTypes.INSERT,
                transaction: t
            }
        );

        await t.commit();
        res.json({ message: 'Level up reward claimed successfully' });
    } catch (error) {
        await t.rollback();
        console.error('Error claiming level up reward:', error);
        res.status(500).json({ message: 'Error claiming level up reward' });
    }
});

// Claim monthly reward
router.post('/claim-monthly-reward', auth, async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['user_id', 'vip_level', 'wallet_balance'],
            transaction: t
        });

        if (!user) {
            await t.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        const currentLevel = await VipLevel.findOne({
            where: { level: user.vip_level },
            transaction: t
        });

        if (!currentLevel) {
            await t.rollback();
            return res.status(404).json({ message: 'VIP level not found' });
        }

        // Check if reward already claimed this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const existingReward = await VipReward.findOne({
            where: {
                user_id: user.id,
                level: currentLevel.level,
                reward_type: 'monthly',
                claimed_at: { [Op.gte]: startOfMonth }
            },
            transaction: t
        });

        if (existingReward) {
            await t.rollback();
            return res.status(400).json({ message: 'Monthly reward already claimed this month' });
        }

        // Create reward record
        await VipReward.create({
            user_id: user.id,
            level: currentLevel.level,
            reward_type: 'monthly',
            amount: currentLevel.monthly_reward,
            claimed_at: new Date()
        }, { transaction: t });

        // Update wallet balance
        await User.update(
            {
                wallet_balance: sequelize.literal(`wallet_balance + ${currentLevel.monthly_reward}`)
            },
            {
                where: { user_id: user.id },
                transaction: t
            }
        );

        // Log transaction
        await sequelize.query(
            `INSERT INTO transactions (user_id, amount, type, note, created_at)
             VALUES (:userId, :amount, 'credit', 'Monthly VIP reward', NOW())`,
            {
                replacements: {
                    userId: user.id,
                    amount: currentLevel.monthly_reward
                },
                type: sequelize.QueryTypes.INSERT,
                transaction: t
            }
        );

        await t.commit();
        res.json({ message: 'Monthly reward claimed successfully' });
    } catch (error) {
        await t.rollback();
        console.error('Error claiming monthly reward:', error);
        res.status(500).json({ message: 'Error claiming monthly reward' });
    }
}); 