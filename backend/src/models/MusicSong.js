'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * A published song for Đua Gõ Theo Nhạc.
 *
 * The row is the contract the client and the scorer share: `lines[]` carries
 * the timed lyrics, `audio_source` carries the rights metadata. Nothing is
 * hardcoded in the gameplay component.
 */
const DIFFICULTY_LABELS = { EASY: 'DỄ', MEDIUM: 'TRUNG BÌNH', HARD: 'KHÓ', EXPERT: 'SIÊU NHANH' };

class MusicSong extends Model {
  toPublic() {
    return {
      id: this.id,
      title: this.title,
      artist: this.artist,
      language: this.language,
      bpm: this.bpm,
      difficulty: this.difficulty,
      difficultyLabel: DIFFICULTY_LABELS[this.difficulty] || 'TRUNG BÌNH',
      durationMs: this.durationMs,
      timedLyricsVersion: this.timedLyricsVersion,
      audioSource: this.audioSource,
      lyricsSource: this.lyricsSource,
      lines: this.lines,
      metrics: this.metrics,
    };
  }
}

MusicSong.init(
  {
    id: { type: DataTypes.STRING(64), primaryKey: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    artist: { type: DataTypes.STRING(150), allowNull: false },
    language: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'VI' },
    bpm: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    difficulty: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'MEDIUM' },
    durationMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'duration_ms' },
    timedLyricsVersion: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1, field: 'timed_lyrics_version' },
    audioSource: { type: DataTypes.JSON, allowNull: false, field: 'audio_source' },
    lyricsSource: { type: DataTypes.JSON, allowNull: false, field: 'lyrics_source' },
    lines: { type: DataTypes.JSON, allowNull: false },
    metrics: { type: DataTypes.JSON, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
    createdBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'MusicSong',
    tableName: 'music_songs',
    underscored: true,
    timestamps: true,
  }
);

module.exports = MusicSong;
