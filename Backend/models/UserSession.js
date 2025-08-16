module.exports = (sequelize, DataTypes) => {
  const UserSession = sequelize.define('UserSession', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    session_token: { type: DataTypes.STRING, allowNull: false, unique: true },
    device_id: { type: DataTypes.STRING, allowNull: false, defaultValue: 'unknown' },
    device_info: { type: DataTypes.JSON, allowNull: true },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    user_agent: { type: DataTypes.TEXT, allowNull: true },
    login_time: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    last_activity: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'user_sessions',
    timestamps: false
  });

  UserSession.associate = (models) => {
    UserSession.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return UserSession;
}; 