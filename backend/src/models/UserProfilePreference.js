const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class UserProfilePreference extends Model {}

UserProfilePreference.init(
  {
    userId: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, allowNull: false, field: 'user_id' },
    avatarData: { type: DataTypes.TEXT('long'), allowNull: true, field: 'avatar_data' },
    featuredBadges: { type: DataTypes.JSON, allowNull: true, field: 'featured_badges_json' },
  },
  {
    sequelize,
    modelName: 'UserProfilePreference',
    tableName: 'user_profile_preferences',
  },
);

module.exports = UserProfilePreference;
