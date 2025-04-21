// models/SeamlessTransaction.js
import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';
import User from './User.js';

const SeamlessTransaction = sequelize.define('SeamlessTransaction', {
  transaction_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'user_id'
    }
  },
  remote_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The remote ID from the game provider'
  },
  provider_transaction_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'The transaction ID from the game provider'
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The game provider code'
  },
  game_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'The game ID'
  },
  game_id_hash: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'The game hash ID'
  },
  round_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'The round ID'
  },
  type: {
    type: DataTypes.ENUM('balance', 'debit', 'credit', 'rollback'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  session_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  wallet_balance_before: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  wallet_balance_after: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  is_freeround_bet: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_freeround_win: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_jackpot_win: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  jackpot_contribution_in_amount: {
    type: DataTypes.DECIMAL(15, 6),
    defaultValue: 0.000000
  },
  gameplay_final: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('success', 'failed', 'rolledback'),
    defaultValue: 'success'
  },
  related_transaction_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reference to original transaction for rollbacks'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'seamless_transactions',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['provider_transaction_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['round_id']
    },
    {
      fields: ['type']
    }
  ]
});

// Establish relationship
User.hasMany(SeamlessTransaction, { foreignKey: 'user_id' });
SeamlessTransaction.belongsTo(User, { foreignKey: 'user_id' });

export default SeamlessTransaction;