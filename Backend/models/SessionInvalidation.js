module.exports = (sequelize, DataTypes) => {
  const SessionInvalidation = sequelize.define('SessionInvalidation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    invalidated_session_token: { type: DataTypes.STRING, allowNull: true },
    invalidated_device_id: { type: DataTypes.STRING, allowNull: true },
    reason: { 
      type: DataTypes.ENUM('new_login', 'manual_logout', 'security_breach', 'expired'), 
      allowNull: false 
    },
    invalidated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    new_device_id: { type: DataTypes.STRING, allowNull: true },
    new_ip_address: { type: DataTypes.STRING(45), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'session_invalidations',
    timestamps: false
  });

  SessionInvalidation.associate = (models) => {
    SessionInvalidation.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return SessionInvalidation;
};