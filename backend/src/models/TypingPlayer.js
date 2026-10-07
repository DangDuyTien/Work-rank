'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class TypingPlayer extends Model {}

TypingPlayer.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'user_id' },
    team: {
      type: DataTypes.ENUM('A', 'B', 'NONE'),
      allowNull: false,
      defaultValue: 'NONE',
    },
    seatIndex: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'seat_index' },
    isReady: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_ready' },
    status: {
      type: DataTypes.ENUM('WAITING', 'TYPING', 'FINISHED', 'DISCONNECTED', 'SURRENDERED'),
      allowNull: false,
      defaultValue: 'WAITING',
    },
    progressPct: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: 'progress_pct' },
    typedChars: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'typed_chars' },
    wpm: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    accuracy: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 100.0 },
    errorCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'error_count' },
    completionTimeMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'completion_time_ms' },
    individualRank: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'individual_rank' },
    scoreDelta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'score_delta' },
    performanceScore: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: 'performance_score' },
    isBot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_bot' },
    botName: { type: DataTypes.STRING(64), allowNull: true, field: 'bot_name' },
    botTargetWpm: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'bot_target_wpm' },
    finalPayload: { type: DataTypes.JSON, allowNull: true, field: 'final_payload' },
  },
  {
    sequelize,
    modelName: 'TypingPlayer',
    tableName: 'typing_players',
    underscored: true,
    timestamps: true,
  }
);

module.exports = TypingPlayer;
