'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
class TypingPracticeAttempt extends Model {}
TypingPracticeAttempt.init({
  id: { type: DataTypes.STRING(36), primaryKey: true },
  userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'READY' },
  durationSeconds: { type: DataTypes.INTEGER, allowNull: false, field: 'duration_seconds' },
  challengeText: { type: DataTypes.TEXT('long'), allowNull: false, field: 'challenge_text' },
  typedText: { type: DataTypes.TEXT('long'), allowNull: false, defaultValue: () => '', field: 'typed_text' },
  inputRevision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'input_revision' },
  musicSongId: { type: DataTypes.STRING(64), allowNull: true, field: 'music_song_id' },
  musicEvidence: { type: DataTypes.JSON, allowNull: true, field: 'music_evidence' },
  startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
  finishedAt: { type: DataTypes.DATE, allowNull: true, field: 'finished_at' },
  result: { type: DataTypes.JSON, allowNull: true },
}, { sequelize, modelName: 'TypingPracticeAttempt', tableName: 'typing_practice_attempts', underscored: true, timestamps: true, indexes: [{ fields: ['user_id', 'status'] }] });
module.exports = TypingPracticeAttempt;
