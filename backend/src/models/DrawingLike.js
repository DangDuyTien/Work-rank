'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DrawingLike = sequelize.define(
  'DrawingLike',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    drawingId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'drawing_id',
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
  },
  {
    tableName: 'drawing_likes',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['drawing_id', 'user_id'] },
      { fields: ['user_id'] },
    ],
  }
);

module.exports = DrawingLike;
