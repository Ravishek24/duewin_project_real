// Backend/models/ThirdPartyWallet.js
const { Model, DataTypes } = require('sequelize');

class ThirdPartyWallet extends Model {
  static init(sequelize) {
    return super.init({
      wallet_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        }
      },
      balance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'INR'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      last_updated: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'ThirdPartyWallet',
      tableName: 'third_party_wallets',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    });
  }

  static associate(models) {
    // Only set up association if User model exists and is properly initialized
    if (models.User && typeof models.User === 'function') {
      this.belongsTo(models.User, {
        foreignKey: 'user_id',
        targetKey: 'user_id',
        as: 'user'
      });
    } else {
      console.warn('User model not found or not properly initialized for ThirdPartyWallet association');
    }
  }
}

module.exports = ThirdPartyWallet;