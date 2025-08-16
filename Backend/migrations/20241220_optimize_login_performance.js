// Migration to optimize login performance with strategic indexes
module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            console.log('🚀 Adding performance indexes for login optimization...');
            
            // 1. Users table indexes for login
            await queryInterface.addIndex('users', ['phone_no'], {
                name: 'idx_users_phone_no_login',
                unique: true
            });
            
            // 2. User sessions indexes for session management
            await queryInterface.addIndex('user_sessions', ['user_id', 'is_active'], {
                name: 'idx_user_sessions_user_active'
            });
            
            await queryInterface.addIndex('user_sessions', ['session_token'], {
                name: 'idx_user_sessions_token',
                unique: true
            });
            
            await queryInterface.addIndex('user_sessions', ['expires_at'], {
                name: 'idx_user_sessions_expires'
            });
            
            // 3. Session invalidations index
            await queryInterface.addIndex('session_invalidations', ['user_id', 'invalidated_at'], {
                name: 'idx_session_invalidations_user_time'
            });
            
            console.log('✅ Performance indexes added successfully');
        } catch (error) {
            console.error('❌ Error adding performance indexes:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            console.log('🔄 Removing performance indexes...');
            
            // Remove indexes in reverse order
            await queryInterface.removeIndex('session_invalidations', 'idx_session_invalidations_user_time');
            await queryInterface.removeIndex('user_sessions', 'idx_user_sessions_expires');
            await queryInterface.removeIndex('user_sessions', 'idx_user_sessions_token');
            await queryInterface.removeIndex('user_sessions', 'idx_user_sessions_user_active');
            await queryInterface.removeIndex('users', 'idx_users_phone_no_login');
            
            console.log('✅ Performance indexes removed successfully');
        } catch (error) {
            console.error('❌ Error removing performance indexes:', error);
            throw error;
        }
    }
};