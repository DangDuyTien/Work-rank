const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ProfileLike extends Model {}

ProfileLike.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    likerId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'liker_id' },
    targetUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'target_user_id' },
    likedDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'liked_date' },
  },
  {
    sequelize,
    modelName: 'ProfileLike',
    tableName: 'profile_likes',
  },
);

module.exports = ProfileLike;
