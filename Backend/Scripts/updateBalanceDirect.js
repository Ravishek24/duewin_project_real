require('dotenv').config();
const { Sequelize } = require('sequelize');

// Initialize Sequelize with environment variables
const sequelize = new Sequelize(
    process.env.DB_NAME || 'duewin_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false
    }
);

// Define User model
const User = sequelize.define('User', {
    user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_name: {
        type: Sequelize.STRING
    },
    phone_no: {
        type: Sequelize.STRING
    },
    wallet_balance: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

async function updateBalance() {
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Find user by phone number
        const user = await User.findOne({
            where: {
                phone_no: '0123456789'
            }
        });

        if (!user) {
            console.error('User not found with phone number: 0123456789');
            process.exit(1);
        }

        // Update balance
        await user.update({
            wallet_balance: 1000
        });

        console.log('Balance updated successfully!');
        console.log('User details:');
        console.log('ID:', user.user_id);
        console.log('Name:', user.user_name);
        console.log('Phone:', user.phone_no);
        console.log('New Balance:', user.wallet_balance);

        // Close database connection
        await sequelize.close();
    } catch (error) {
        console.error('Error updating balance:', error);
        process.exit(1);
    }
}

// Run the update
updateBalance(); 