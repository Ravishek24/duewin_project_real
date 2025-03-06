import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const WalletRecharge = sequelize.define('WalletRecharge', {
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
    added_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    /// Order id 
    order_id: {
        type: DataTypes.STRING
    },
    time_of_success: {
        type: DataTypes.DATE
    },
    payment_gateway: {
        type: DataTypes.STRING
    },
    payment_status: {
        type: DataTypes.BOOLEAN
    },
}, {
    tableName: 'wallet_recharges',
    timestamps: false
});

export default WalletRecharge;
