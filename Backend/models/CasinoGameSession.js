const { Model, DataTypes } = require('sequelize');

class CasinoGameSession extends Model {
  static init(sequelize) {
    return super.init({
      session_id: {
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
      member_account: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Player account name used in casino API'
      },
      game_uid: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Game UID from casino provider'
      },
      session_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Session token from casino provider'
      },
      game_launch_url: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Game launch URL from casino provider'
      },
      credit_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Credit amount allocated for this session'
      },
      currency_code: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
        comment: 'Currency code for this session'
      },
      language: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: 'en',
        comment: 'Game language'
      },
      platform: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'web',
        comment: 'Platform (web, H5)'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether session is currently active'
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP address of the player'
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'When the session started'
      },
      closed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the session was closed'
      },
      last_activity: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Last activity timestamp'
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
      modelName: 'CasinoGameSession',
      tableName: 'casino_game_sessions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['member_account']
        },
        {
          fields: ['session_token']
        },
        {
          fields: ['is_active']
        },
        {
          fields: ['started_at']
        }
      ]
    });
  }

  static associate(models) {
    if (models.User && typeof models.User === 'function') {
      this.belongsTo(models.User, {
        foreignKey: 'user_id',
        targetKey: 'user_id',
        as: 'user'
      });
    }
    
    if (models.CasinoTransaction && typeof models.CasinoTransaction === 'function') {
      this.hasMany(models.CasinoTransaction, {
        foreignKey: 'session_id',
        sourceKey: 'session_id',
        as: 'transactions'
      });
    }
  }
}

module.exports = CasinoGameSession;
