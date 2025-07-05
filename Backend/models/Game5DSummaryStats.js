const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Game5DSummaryStats extends Model {}

  Game5DSummaryStats.init({
    sum_value: {
      type: DataTypes.TINYINT.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      comment: 'Sum of dice values (0 to 45)',
    },
    combination_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Total combinations with this sum',
    },
    common_positions: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Most frequent dice values/positions for this sum',
    },
    probability: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      comment: 'Probability of this sum (e.g., 0.025)',
    },
  }, {
    sequelize,
    modelName: 'Game5DSummaryStats',
    tableName: 'game_5d_summary_stats',
    timestamps: false,
  });

  return Game5DSummaryStats;
}; 