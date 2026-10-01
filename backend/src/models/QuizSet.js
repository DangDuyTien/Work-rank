'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class QuizSet extends Model {}

QuizSet.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    category: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'Chung' },
    imageUrl: { type: DataTypes.TEXT, allowNull: true, field: 'image_url' },
    shareCode: { type: DataTypes.STRING(64), allowNull: true, unique: true, field: 'share_code' },
    status: {
      type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
      allowNull: false,
      defaultValue: 'PUBLISHED',
    },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    createdByUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'created_by_user_id' },
  },
  {
    sequelize,
    modelName: 'QuizSet',
    tableName: 'quiz_sets',
    underscored: true,
    timestamps: true,
  }
);

module.exports = QuizSet;
