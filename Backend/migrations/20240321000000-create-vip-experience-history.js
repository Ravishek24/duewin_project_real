module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('vip_experience_history', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'user_id'
                }
            },
            exp_gained: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            bet_amount: {
                type: Sequelize.DECIMAL(15, 2),
                allowNull: false
            },
            game_type: {
                type: Sequelize.STRING,
                allowNull: false
            },
            game_id: {
                type: Sequelize.STRING,
                allowNull: true
            },
            exp_before: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            exp_after: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            }
        });

        // Add indexes
        await queryInterface.addIndex('vip_experience_history', ['user_id']);
        await queryInterface.addIndex('vip_experience_history', ['game_type']);
        await queryInterface.addIndex('vip_experience_history', ['created_at']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('vip_experience_history');
    }
}; 