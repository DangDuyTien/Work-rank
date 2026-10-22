'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Drawing = sequelize.define(
  'Drawing',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: 'Tác phẩm không tên',
    },
    imageUrl: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
      field: 'image_url',
    },
    // Object key trong persistent storage (nguồn sự thật để delete/migrate).
    // NULL = bản ghi legacy (ảnh cũ nằm ở /uploads hoặc data URI).
    storageKey: {
      type: DataTypes.STRING(512),
      allowNull: true,
      field: 'storage_key',
    },
    storageProvider: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'storage_provider',
    },
    mimeType: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'mime_type',
    },
    sizeBytes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'size_bytes',
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1200,
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 700,
    },
    visibility: {
      type: DataTypes.ENUM('PUBLIC', 'TEAM', 'PRIVATE'),
      allowNull: false,
      defaultValue: 'PUBLIC',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'HIDDEN', 'DELETED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    likesCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'likes_count',
    },
    viewsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'views_count',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: 'drawings',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status', 'visibility', 'created_at'] },
      { fields: ['likes_count'] },
    ],
  }
);

module.exports = Drawing;
