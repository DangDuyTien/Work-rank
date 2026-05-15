const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class UserProfileImage extends Model {}

UserProfileImage.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    slot: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    imageData: { type: DataTypes.TEXT('long'), allowNull: false, field: 'image_data' },
  },
  {
    sequelize,
    modelName: 'UserProfileImage',
    tableName: 'user_profile_images',
    indexes: [{ unique: true, fields: ['user_id', 'slot'] }],
  },
);

module.exports = UserProfileImage;
