const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class GameCombinations5D extends Model {}

  GameCombinations5D.init({
    combination_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    dice_value: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      // Indexed
    },
    dice_a: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      // Indexed
    },
    dice_b: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      // Indexed
    },
    dice_c: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
    },
    dice_d: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
    },
    dice_e: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
    },
    sum_value: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      // Generated column in DB, but must be present for queries
    },
    sum_size: {
      type: DataTypes.ENUM('big', 'small'),
      allowNull: false,
      // Indexed
    },
    sum_parity: {
      type: DataTypes.ENUM('odd', 'even'),
      allowNull: false,
    },
    position_flags: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      // Indexed
    },
    estimated_exposure_score: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: 0,
      // Indexed
    },
    winning_conditions: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'GameCombinations5D',
    tableName: 'game_combinations_5d',
    timestamps: false,
    indexes: [
      { fields: ['dice_value'] },
      { fields: ['sum_value', 'dice_value'], unique: true, name: 'uk_dice_value' },
      { fields: ['sum_size', 'sum_parity'], name: 'idx_sum_properties' },
      { fields: ['position_flags'], name: 'idx_position_flags' },
      { fields: ['estimated_exposure_score'], name: 'idx_estimated_score' },
      { fields: ['dice_a', 'sum_size', 'sum_parity'], name: 'idx_dice_a_sum_size_parity' },
      { fields: ['sum_size', 'sum_parity', 'estimated_exposure_score'], name: 'idx_sum_score_combo' },
      { fields: ['dice_b', 'position_flags'], name: 'idx_dice_b_position_flags' },
    ],
    // Partitioning is handled at the DB level, not in Sequelize
  });

  return GameCombinations5D;
}; 