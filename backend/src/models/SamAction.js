'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SamAction extends Model {}

SamAction.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    actionType: {
      type: DataTypes.ENUM('DEAL', 'DECLARE_SAM', 'SKIP_SAM', 'PLAY', 'PASS', 'CHOP', 'TIMEOUT', 'FINISH'),
      allowNull: false,
      field: 'action_type',
    },
    cards: { type: DataTypes.JSON, allowNull: true },
    comboType: { type: DataTypes.STRING(32), allowNull: true, field: 'combo_type' },
    metadata: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: 'SamAction',
    tableName: 'sam_actions',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  }
);

module.exports = SamAction;
