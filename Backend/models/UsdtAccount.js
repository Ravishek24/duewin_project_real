import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js'; // Ensure correct import

const UsdtAccount = sequelize.define('UsdtAccount', { // Use correct variable name
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    phone_no: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            len: [10, 15] // Ensures phone number length is between 10 and 15 characters
        }
    },
    wallet_address: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    tableName: 'usdt_account',
    timestamps: false
});

export default UsdtAccount; // Correctly export the variable
