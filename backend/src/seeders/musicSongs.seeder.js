'use strict';

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.resolve(__dirname, '../../../shared/music/songCatalog.json');

function readCatalog() {
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (error) {
    console.warn('[MusicSongs] cannot read catalog:', error.message);
    return { songs: [] };
  }
}

/**
 * The bundled catalog is the seed, not the source of truth at runtime: admins
 * can publish more rows, but a fresh database must still open with playable
 * songs on the first request.
 */
async function seedMusicSongs({ force = false } = {}) {
  const { MusicSong } = require('../models');
  const catalog = readCatalog();
  if (!Array.isArray(catalog.songs) || catalog.songs.length === 0) return [];

  const existing = await MusicSong.count();
  if (existing > 0 && !force) return [];

  const rows = catalog.songs.map((song) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    language: song.language || 'VI',
    bpm: Number(song.bpm) || 0,
    difficulty: song.difficulty || 'MEDIUM',
    durationMs: Number(song.durationMs) || 0,
    timedLyricsVersion: Number(song.timedLyricsVersion) || 1,
    audioSource: song.audioSource,
    lyricsSource: song.lyricsSource,
    lines: song.lines,
    metrics: song.metrics || null,
    isActive: true,
    publishedAt: new Date(),
    createdBy: null,
  }));

  await MusicSong.bulkCreate(rows, { ignoreDuplicates: true });
  return rows.map((row) => row.id);
}

module.exports = { seedMusicSongs, readCatalog, CATALOG_PATH };
