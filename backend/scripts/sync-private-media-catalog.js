'use strict';

/**
 * PRIVATE MEDIA — CURATED CATALOG SYNC
 *
 * Rebuilds `src/data/private-media-catalog.json` from the OFFICIAL YouTube
 * playlists and (optionally) upserts it into the database.
 *
 * Why a script instead of hard-coded ids in the app:
 *   - every item is verified against the YouTube Data API (public + embeddable)
 *   - the catalog can be completed later by re-running this script, with no
 *     application code change
 *   - the JSON is the reviewable source of truth; the DB is the runtime copy
 *
 * Usage:
 *   node scripts/sync-private-media-catalog.js            # write JSON only
 *   node scripts/sync-private-media-catalog.js --apply     # write JSON + DB
 *
 * Requires YOUTUBE_API_KEY. Never scrapes HTML.
 */

const fs = require('node:fs');
const path = require('node:path');
const env = require('../src/config/env');
const { parseIsoDuration } = require('../src/services/privateMedia/youtube.service');

const API = 'https://www.googleapis.com/youtube/v3';
const OUTPUT = path.join(__dirname, '..', 'src', 'data', 'private-media-catalog.json');
const REQUEST_TIMEOUT_MS = 15000;

const SOURCES = [
  {
    slug: 'vit-do-mixi',
    title: 'Vịt Độ Mixi',
    description: 'Goose Goose Duck — series chơi game "vịt/ngỗng" của Độ Mixi trên kênh chính thức MixiGaming.',
    sourcePlaylistId: 'PLio30oCA4I3d9kgQesZx_KfmHfDLeP4az',
    sourceChannel: 'MixiGaming',
    order: 'oldest-first',
    expectedCount: null,
  },
  {
    slug: 'conan-1-200',
    title: 'Thám Tử Lừng Danh Conan — Tập 1–200',
    description: 'Trích từ playlist "Trọn Bộ Thám Tử Lừng Danh Conan Lồng Tiếng" của kênh chính thức POPS Anime.',
    sourcePlaylistId: 'PLKvoOwlacRoLbAmCd_0HsADRTCD4oo0Mv',
    sourceChannel: 'POPS Anime',
    order: 'episode',
    expectedCount: 200,
    episodeRange: [1, 200],
  },
];

function apiKey() {
  const key = String(env.privateMedia?.youtubeApiKey || '').trim();
  if (!key) throw new Error('YOUTUBE_API_KEY is required to sync the catalog');
  return key;
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

function decode(value) {
  return String(value || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCodePoint(parseInt(c, 16)))
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Full pagination — the first page is never the whole playlist. */
async function listPlaylistItems(playlistId) {
  const items = [];
  let pageToken = '';
  do {
    const url = new URL(`${API}/playlistItems`);
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('key', apiKey());
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await getJson(url);
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return items;
}

/** Availability + duration for up to 50 ids per request. */
async function videoDetails(ids) {
  const map = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const url = new URL(`${API}/videos`);
    url.searchParams.set('part', 'status,contentDetails,snippet');
    url.searchParams.set('id', ids.slice(i, i + 50).join(','));
    url.searchParams.set('key', apiKey());
    const data = await getJson(url);
    (data.items || []).forEach((video) => map.set(video.id, video));
  }
  return map;
}

function unavailableReason(video) {
  if (!video) return 'NOT_FOUND';
  if (video.status?.privacyStatus !== 'public') return 'NOT_PUBLIC';
  if (video.status?.embeddable !== true) return 'NOT_EMBEDDABLE';
  if (video.status?.uploadStatus && video.status.uploadStatus !== 'processed') return 'NOT_PROCESSED';
  return null;
}

function episodeNumberFrom(title) {
  const match = /(?:Tập|Tap|TẬP)\s*#?\s*(\d{1,4})/i.exec(title);
  return match ? Number(match[1]) : null;
}

async function buildPlaylist(source) {
  const raw = await listPlaylistItems(source.sourcePlaylistId);
  const rows = [];

  for (const entry of raw) {
    const title = decode(entry.snippet?.title);
    if (!title || /^(Private video|Deleted video)$/i.test(title)) continue;
    const videoId = entry.contentDetails?.videoId || entry.snippet?.resourceId?.videoId;
    if (!videoId) continue;
    rows.push({
      videoId,
      title,
      publishedAt: entry.contentDetails?.videoPublishedAt || entry.snippet?.publishedAt || null,
      playlistPosition: Number(entry.snippet?.position) || 0,
      episodeNumber: episodeNumberFrom(title),
    });
  }

  const details = await videoDetails([...new Set(rows.map((row) => row.videoId))]);
  let items = rows.map((row) => {
    const video = details.get(row.videoId);
    const reason = unavailableReason(video);
    return {
      videoId: row.videoId,
      title: row.title,
      channelTitle: decode(video?.snippet?.channelTitle) || source.sourceChannel,
      thumbnailUrl: `https://i.ytimg.com/vi/${row.videoId}/mqdefault.jpg`,
      durationSeconds: parseIsoDuration(video?.contentDetails?.duration) || null,
      episodeNumber: row.episodeNumber,
      publishedAt: row.publishedAt,
      available: !reason,
      unavailableReason: reason,
      _playlistPosition: row.playlistPosition,
    };
  });

  let missingEpisodes = [];
  if (source.episodeRange) {
    const [from, to] = source.episodeRange;
    // One row per episode, first occurrence wins (official playlist order).
    const byEpisode = new Map();
    for (const item of items) {
      if (item.episodeNumber == null) continue;
      if (item.episodeNumber < from || item.episodeNumber > to) continue;
      if (!byEpisode.has(item.episodeNumber)) byEpisode.set(item.episodeNumber, item);
    }
    items = [...byEpisode.values()].sort((a, b) => a.episodeNumber - b.episodeNumber);
    for (let episode = from; episode <= to; episode += 1) {
      if (!byEpisode.has(episode)) missingEpisodes.push(episode);
    }
  } else if (source.order === 'oldest-first') {
    items = items.sort((a, b) => String(a.publishedAt || '').localeCompare(String(b.publishedAt || '')) || a._playlistPosition - b._playlistPosition);
  } else {
    items = items.sort((a, b) => a._playlistPosition - b._playlistPosition);
  }

  items = items.map((item, index) => {
    const { _playlistPosition, ...rest } = item;
    return { ...rest, position: index };
  });

  const available = items.filter((item) => item.available);
  return {
    slug: source.slug,
    title: source.title,
    description: source.description,
    kind: 'curated',
    visibility: 'shared',
    playbackMode: 'sequential',
    repeatMode: 'off',
    sourceType: 'youtube-playlist',
    sourcePlaylistId: source.sourcePlaylistId,
    sourceChannel: source.sourceChannel,
    sourceUrl: `https://www.youtube.com/playlist?list=${source.sourcePlaylistId}`,
    coverUrl: available[0]?.thumbnailUrl || null,
    expectedCount: source.expectedCount ?? raw.length,
    verifiedCount: available.length,
    missingEpisodes,
    items,
  };
}

async function applyToDatabase(catalog) {
  // Required lazily so `--apply` is the only path that needs a database.
  const { sequelize, PrivateMediaPlaylist, PrivateMediaPlaylistItem } = require('../src/models');

  for (const playlist of catalog.playlists) {
    const payload = {
      slug: playlist.slug,
      ownerUserId: null,
      title: playlist.title,
      description: playlist.description,
      kind: 'curated',
      visibility: 'shared',
      playbackMode: playlist.playbackMode,
      repeatMode: playlist.repeatMode,
      sourceType: playlist.sourceType,
      sourcePlaylistId: playlist.sourcePlaylistId,
      sourceChannel: playlist.sourceChannel,
      sourceUrl: playlist.sourceUrl,
      coverUrl: playlist.coverUrl,
      itemCount: playlist.verifiedCount,
      expectedCount: playlist.expectedCount,
      verifiedAt: new Date(catalog.generatedAt),
    };

    const [row] = await PrivateMediaPlaylist.findOrCreate({ where: { slug: playlist.slug }, defaults: payload });
    if (row.id && row.kind !== 'curated') throw new Error(`slug ${playlist.slug} is owned by a user playlist`);
    await row.update(payload);

    // Replace items atomically enough for a catalog refresh: the playback engine
    // keeps its own snapshot, so a running cycle is unaffected.
    await PrivateMediaPlaylistItem.destroy({ where: { playlistId: row.id } });
    const chunk = 200;
    for (let i = 0; i < playlist.items.length; i += chunk) {
      await PrivateMediaPlaylistItem.bulkCreate(playlist.items.slice(i, i + chunk).map((item) => ({
        playlistId: row.id,
        videoId: item.videoId,
        title: item.title,
        channelTitle: item.channelTitle,
        thumbnailUrl: item.thumbnailUrl,
        durationSeconds: item.durationSeconds,
        episodeNumber: item.episodeNumber,
        position: item.position,
        available: item.available,
        unavailableReason: item.unavailableReason,
      })));
    }
    console.log(`applied ${playlist.slug}: ${playlist.items.length} rows (${playlist.verifiedCount} playable)`);
  }

  await sequelize.close();
}

(async () => {
  const playlists = [];
  for (const source of SOURCES) {
    process.stdout.write(`syncing ${source.slug} … `);
    const playlist = await buildPlaylist(source);
    playlists.push(playlist);
    console.log(`${playlist.verifiedCount}/${playlist.expectedCount} playable${playlist.missingEpisodes.length ? `, missing ${playlist.missingEpisodes.length}` : ''}`);
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: 'youtube-data-api-v3',
    playlists,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`wrote ${path.relative(process.cwd(), OUTPUT)}`);

  if (process.argv.includes('--apply')) await applyToDatabase(catalog);
})().catch((error) => {
  console.error('catalog sync failed:', error.message);
  process.exit(1);
});
