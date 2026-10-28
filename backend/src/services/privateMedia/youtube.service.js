'use strict';

/**
 * PRIVATE MEDIA — YOUTUBE LOOKUP
 *
 * Policy boundaries (non-negotiable):
 *  - Playback uses the OFFICIAL YouTube IFrame Player API in the browser.
 *  - No audio extraction, no download, no ad bypass, no stream proxying.
 *  - Search uses the official YouTube Data API v3 and requires YOUTUBE_API_KEY.
 *  - Loading a specific video also works WITHOUT a key through YouTube's public
 *    oEmbed metadata endpoint, so the player is usable before a key is issued.
 */

const env = require('../../config/env');

const SEARCH_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 7000;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const searchCache = new Map();

class YouTubeUnavailableError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = 'YouTubeUnavailableError';
    this.code = code;
    this.status = status;
  }
}

function apiKey() {
  return String(env.privateMedia?.youtubeApiKey || '').trim();
}

function hasApiKey() {
  return apiKey().length > 0;
}

/** Accepts a bare id, youtu.be link, watch link, shorts/embed/live link. */
function parseVideoId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (VIDEO_ID_PATTERN.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
    return null;
  }

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  const v = url.searchParams.get('v');
  if (v && VIDEO_ID_PATTERN.test(v)) return v;

  const match = url.pathname.match(/\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

function parseIsoDuration(value) {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ''));
  if (!match) return null;
  const [, d, h, m, s] = match;
  const total = (Number(d) || 0) * 86400 + (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
  return total > 0 ? total : null;
}

/**
 * YouTube Data API returns HTML-escaped snippets ("90&#39;s Chill", "&quot;…&quot;").
 * Rendering them raw leaks entities into the UI, so decode once at the boundary.
 * `&amp;` must be replaced last to avoid double-decoding "&amp;#39;".
 */
function decodeHtmlEntities(value) {
  if (value == null) return value;
  return String(value)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new YouTubeUnavailableError(
      response.status === 403 ? 'YOUTUBE_QUOTA_OR_KEY_REJECTED' : 'YOUTUBE_REQUEST_FAILED',
      `YouTube trả về ${response.status}${text ? `: ${text.slice(0, 160)}` : ''}`,
      response.status === 403 ? 429 : 502,
    );
  }
  return response.json();
}

/** Keyless metadata for a single video (title, channel, thumbnail). */
async function resolveViaOEmbed(videoId) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  const data = await fetchJson(url);
  return {
    videoId,
    title: data.title || null,
    channelTitle: data.author_name || null,
    thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationSeconds: null,
    source: 'oembed',
  };
}

async function resolveViaDataApi(videoId) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', apiKey());

  const data = await fetchJson(url.toString());
  const item = data.items?.[0];
  if (!item) throw new YouTubeUnavailableError('VIDEO_NOT_FOUND', 'Không tìm thấy video này', 404);

  return {
    videoId,
    title: decodeHtmlEntities(item.snippet?.title)?.trim() || null,
    channelTitle: decodeHtmlEntities(item.snippet?.channelTitle)?.trim() || null,
    thumbnailUrl: item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    source: 'data-api',
  };
}

/**
 * Resolve a URL/id into playable metadata. Uses the Data API when available and
 * falls back to oEmbed so the player works with zero credentials.
 */
async function resolveVideo(input) {
  const videoId = parseVideoId(input);
  if (!videoId) {
    throw new YouTubeUnavailableError('INVALID_VIDEO', 'Link hoặc mã video YouTube không hợp lệ', 400);
  }

  if (hasApiKey()) {
    try {
      return await resolveViaDataApi(videoId);
    } catch (error) {
      if (error.code === 'VIDEO_NOT_FOUND') throw error;
      // Quota/key problems should not block a plain "paste a link" flow.
    }
  }

  try {
    return await resolveViaOEmbed(videoId);
  } catch (error) {
    throw new YouTubeUnavailableError(
      'VIDEO_UNRESOLVED',
      'Không đọc được thông tin video. Kiểm tra lại link hoặc cấu hình YOUTUBE_API_KEY.',
      502,
    );
  }
}

/**
 * Official Data API search. Requires YOUTUBE_API_KEY — no scraping fallback.
 */
async function search({ query, limit = 12 }) {
  const term = String(query || '').trim();
  if (term.length < 2) {
    throw new YouTubeUnavailableError('INVALID_QUERY', 'Nhập ít nhất 2 ký tự để tìm video', 400);
  }

  if (!hasApiKey()) {
    throw new YouTubeUnavailableError(
      'YOUTUBE_SEARCH_UNAVAILABLE',
      'Chưa cấu hình YOUTUBE_API_KEY nên không tìm kiếm được. Bạn vẫn có thể dán link YouTube để phát.',
      503,
    );
  }

  const cacheKey = `${term.toLowerCase()}|${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) return cached.value;

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', String(Math.min(Math.max(Number(limit) || 12, 1), 25)));
  searchUrl.searchParams.set('q', term);
  searchUrl.searchParams.set('key', apiKey());

  const searchData = await fetchJson(searchUrl.toString());
  const items = Array.isArray(searchData.items) ? searchData.items : [];
  const ids = items.map((item) => item.id?.videoId).filter(Boolean);

  let durations = new Map();
  if (ids.length) {
    try {
      const detailUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      detailUrl.searchParams.set('part', 'contentDetails');
      detailUrl.searchParams.set('id', ids.join(','));
      detailUrl.searchParams.set('key', apiKey());
      const detail = await fetchJson(detailUrl.toString());
      durations = new Map((detail.items || []).map((item) => [item.id, parseIsoDuration(item.contentDetails?.duration)]));
    } catch {
      // Durations are cosmetic; a failed detail call must not kill the results.
    }
  }

  const value = {
    query: term,
    items: items.map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;
      return {
        videoId,
        title: decodeHtmlEntities(item.snippet?.title)?.trim() || null,
        channelTitle: decodeHtmlEntities(item.snippet?.channelTitle)?.trim() || null,
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        durationSeconds: durations.get(videoId) ?? null,
        publishedAt: item.snippet?.publishedAt || null,
      };
    }).filter(Boolean),
  };

  searchCache.set(cacheKey, { value, at: Date.now() });
  if (searchCache.size > 50) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) searchCache.delete(oldest[0]);
  }

  return value;
}

function capabilities() {
  return {
    search: hasApiKey(),
    resolve: true,
    // Never leak the key itself — only whether it is configured.
    reason: hasApiKey() ? null : 'YOUTUBE_API_KEY_MISSING',
  };
}

module.exports = {
  YouTubeUnavailableError,
  hasApiKey,
  parseVideoId,
  parseIsoDuration,
  decodeHtmlEntities,
  resolveVideo,
  search,
  capabilities,
};
