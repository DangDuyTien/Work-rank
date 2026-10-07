'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class TypingRoom extends Model {}

TypingRoom.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    hostUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'host_user_id' },
    mode: {
      type: DataTypes.ENUM('SOLO', '1V1', '2V2', '3V3'),
      allowNull: false,
      defaultValue: '1V1',
    },
    matchType: {
      type: DataTypes.ENUM('PRACTICE', 'RANKED', 'TOURNAMENT'),
      allowNull: false,
      defaultValue: 'RANKED',
      field: 'match_type',
    },
    status: {
      type: DataTypes.ENUM('WAITING', 'STARTING', 'PLAYING', 'FINISHED', 'ABANDONED'),
      allowNull: false,
      defaultValue: 'WAITING',
    },
    maxPlayers: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 2, field: 'max_players' },
    challengeId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'challenge_id' },
    targetWordCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'target_word_count' },
    challengeText: { type: DataTypes.TEXT, allowNull: true, field: 'challenge_text' },
    difficulty: {
      type: DataTypes.ENUM('EASY', 'MEDIUM', 'HARD', 'EXPERT'),
      allowNull: false,
      defaultValue: 'MEDIUM',
    },
    startAt: { type: DataTypes.DATE, allowNull: true, field: 'start_at' },
    startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
    finishedAt: { type: DataTypes.DATE, allowNull: true, field: 'finished_at' },
    durationLimitSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 180, field: 'duration_limit_seconds' },
    winnerTeam: {
      type: DataTypes.ENUM('A', 'B', 'DRAW', 'NONE'),
      allowNull: false,
      defaultValue: 'NONE',
      field: 'winner_team',
    },
    winnerUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'winner_user_id' },
    isTest: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_test' },
  },
  {
    sequelize,
    modelName: 'TypingRoom',
    tableName: 'typing_rooms',
    underscored: true,
    timestamps: true,
  }
);

module.exports = TypingRoom;
