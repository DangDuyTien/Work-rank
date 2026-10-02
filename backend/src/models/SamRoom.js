'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SamRoom extends Model {}

SamRoom.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    title: { type: DataTypes.STRING(120), allowNull: false, defaultValue: 'Phòng Đánh Sâm' },
    hostUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'host_user_id' },
    status: {
      type: DataTypes.ENUM('WAITING', 'STARTING', 'PLAYING', 'FINISHED', 'ABANDONED'),
      allowNull: false,
      defaultValue: 'WAITING',
    },
    maxPlayers: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 4, field: 'max_players' },
    currentTurnUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'current_turn_user_id' },
    currentTurnSeat: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'current_turn_seat' },
    turnDeadline: { type: DataTypes.DATE, allowNull: true, field: 'turn_deadline' },
    turnDurationSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 25, field: 'turn_duration_seconds' },
    roundNumber: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1, field: 'round_number' },
    lastPlayedCards: { type: DataTypes.JSON, allowNull: true, field: 'last_played_cards' },
    lastPlayUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'last_play_user_id' },
    passPlayerIds: { type: DataTypes.JSON, allowNull: true, field: 'pass_player_ids' },
    samDeclarerId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'sam_declarer_id' },
    samPhase: {
      type: DataTypes.ENUM('WAITING', 'STARTING', 'SAM_DECLARING', 'PLAYING', 'FINISHED'),
      allowNull: false,
      defaultValue: 'WAITING',
      field: 'sam_phase',
    },
    roomType: {
      type: DataTypes.ENUM('LIVE', 'BOT_TEST'),
      allowNull: false,
      defaultValue: 'LIVE',
      field: 'room_type',
    },
    isTest: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_test',
    },
    botDifficulty: {
      type: DataTypes.ENUM('EASY', 'NORMAL', 'HARD'),
      allowNull: false,
      defaultValue: 'NORMAL',
      field: 'bot_difficulty',
    },
    botPaused: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'bot_paused',
    },
    testScenario: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'test_scenario',
    },
    spectatorCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'spectator_count',
    },
    winnerUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'winner_user_id' },
    startAt: { type: DataTypes.DATE, allowNull: true, field: 'start_at' },
    startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
    finishedAt: { type: DataTypes.DATE, allowNull: true, field: 'finished_at' },
  },
  {
    sequelize,
    modelName: 'SamRoom',
    tableName: 'sam_rooms',
    underscored: true,
    timestamps: true,
  }
);

module.exports = SamRoom;
