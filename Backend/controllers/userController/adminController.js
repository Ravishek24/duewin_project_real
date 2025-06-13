const updateUserVipLevel = async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
        const { user_id } = req.params;
        const { vip_level } = req.body;

        // Validate VIP level
        const vipLevel = await VipLevel.findOne({
            where: { level: vip_level },
            transaction: t
        });

        if (!vipLevel) {
            await t.rollback();
            return res.status(400).json({ message: 'Invalid VIP level' });
        }

        // Update user's VIP level
        await User.update(
            { vip_level },
            { where: { user_id }, transaction: t }
        );

        // Update vault interest rate
        const vault = await UserVault.findOne({
            where: { user_id },
            transaction: t
        });

        if (vault) {
            await vault.update({
                interest_rate: vipLevel.vault_interest_rate
            }, { transaction: t });
        }

        await t.commit();

        return res.json({
            success: true,
            message: 'User VIP level updated successfully',
            vip_level,
            vault_interest_rate: vipLevel.vault_interest_rate
        });

    } catch (error) {
        await t.rollback();
        console.error('Error updating user VIP level:', error);
        return res.status(500).json({ message: 'Error updating user VIP level' });
    }
}; 