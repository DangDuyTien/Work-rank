'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GameCatalog extends Model {}

GameCatalog.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    gameKey: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'game_key',
    },
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('AVAILABLE', 'COMING_SOON'),
      allowNull: false,
      defaultValue: 'AVAILABLE',
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    route: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'GameCatalog',
    tableName: 'game_catalogs',
    underscored: true,
    timestamps: true,
  },
);

module.exports = GameCatalog;
