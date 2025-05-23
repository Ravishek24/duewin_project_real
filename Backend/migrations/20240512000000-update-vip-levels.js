'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // First, clear existing VIP levels
      await queryInterface.bulkDelete('vip_levels', null, {});

      // Insert new VIP levels
      await queryInterface.bulkInsert('vip_levels', [
        { 
          level: 1,
          required_exp: 1000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 2,
          required_exp: 5000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 3,
          required_exp: 10000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 4,
          required_exp: 50000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 5,
          required_exp: 100000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 6,
          required_exp: 500000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 7,
          required_exp: 1000000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 8,
          required_exp: 5000000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 9,
          required_exp: 10000000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 10,
          required_exp: 50000000,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      console.log('VIP levels updated successfully');
    } catch (error) {
      console.error('Error updating VIP levels:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Revert to previous VIP levels
      await queryInterface.bulkDelete('vip_levels', null, {});
      
      await queryInterface.bulkInsert('vip_levels', [
        { 
          level: 1,
          required_exp: 3000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 2,
          required_exp: 30000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 3,
          required_exp: 400000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 4,
          required_exp: 4000000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 5,
          required_exp: 20000000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 6,
          required_exp: 80000000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 7,
          required_exp: 300000000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 8,
          required_exp: 1000000000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 9,
          required_exp: 50000000000,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          level: 10,
          required_exp: 999999999,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      console.log('VIP levels reverted successfully');
    } catch (error) {
      console.error('Error reverting VIP levels:', error);
      throw error;
    }
  }
}; 