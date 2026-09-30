'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GameProperty extends Model {}

GameProperty.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    tileIndex: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'tile_index' },
    propertyKey: { type: DataTypes.STRING(50), allowNull: false, field: 'property_key' },
    propertyName: { type: DataTypes.STRING(100), allowNull: false, field: 'property_name' },
    price: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    rent: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    groupKey: { type: DataTypes.STRING(30), allowNull: false, field: 'group_key' },
    groupColor: { type: DataTypes.STRING(30), allowNull: false, field: 'group_color' },
    ownerUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'owner_user_id' },
  },
  {
    sequelize,
    modelName: 'GameProperty',
    tableName: 'game_properties',
    underscored: true,
    indexes: [
      { unique: true, fields: ['room_id', 'tile_index'], name: 'unique_room_tile' },
      { unique: true, fields: ['room_id', 'property_key'], name: 'unique_room_property_key' },
    ],
  }
);

module.exports = GameProperty;
