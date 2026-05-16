const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Friendship extends Model {}

Friendship.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    requesterId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'requester_id' },
    addresseeId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'addressee_id' },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined'),
      allowNull: false,
      defaultValue: 'pending',
    },
  },
  {
    sequelize,
    modelName: 'Friendship',
    tableName: 'friendships',
  },
);

module.exports = Friendship;
