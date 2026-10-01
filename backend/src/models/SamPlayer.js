'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SamPlayer extends Model {}

SamPlayer.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    seatIndex: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'seat_index' },
    handCards: { type: DataTypes.JSON, allowNull: false, field: 'hand_cards' },
    remainingCardsCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10, field: 'remaining_cards_count' },
    status: {
      type: DataTypes.ENUM('WAITING', 'ACTIVE', 'FINISHED', 'SURRENDERED', 'DISCONNECTED'),
      allowNull: false,
      defaultValue: 'WAITING',
    },
    hasDeclaredSam: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'has_declared_sam' },
    isBaoMot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_bao_mot' },
    scoreDelta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'score_delta' },
    rank: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'joined_at' },
  },
  {
    sequelize,
    modelName: 'SamPlayer',
    tableName: 'sam_players',
    underscored: true,
    timestamps: true,
  }
);

module.exports = SamPlayer;
