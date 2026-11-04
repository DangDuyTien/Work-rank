import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronUp, Download, ListMusic, Loader2, Play, Plus,
  RefreshCw, Search, Shuffle, Trash2, X,
} from 'lucide-react';
import { usePrivateMedia } from '../../context/PrivateMediaContext';
import { privateMediaApi } from '../../services/privateMediaApi';
import { formatTime } from './mediaTime';

/**
 * DANH SÁCH PHÁT
 *
 * Three sources in one panel:
 *   Có sẵn  → curated catalog (read-only, seeded from verified YouTube data)
 *   Của tôi → the caller's own playlists (full CRUD)
 *   +       → create empty, or import a YouTube playlist by URL
 *
 * The panel never decides permissions: `playlist.editable` comes from the
 * server, and every write is re-authorized there.
 */

const TABS = [
  { key: 'curated', label: 'Có sẵn' },
  { key: 'mine', label: 'Của tôi' },
];

export default function PlaylistPanel({ canPlay, canQueue }) {
  const { playlists, session, permissions } = usePrivateMedia();
  const [tab, setTab] = useState('curated');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftVisibility, setDraftVisibility] = useState('private');
  const [draftUrl, setDraftUrl] = useState('');
  const [note, setNote] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addUrl, setAddUrl] = useState('');

  const detail = playlists.detail;
  const items = detail?.items || [];

  useEffect(() => {
    if (!detail) return;
    if (tab === 'mine' && !detail.editable) setTab('curated');
  }, [detail, tab]);

  const visible = useMemo(() => playlists.list.filter((playlist) => (
    tab === 'curated' ? playlist.kind === 'curated' : playlist.kind === 'user'
  )), [playlists.list, tab]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => `${item.episodeNumber || ''} ${item.title || ''}`.toLowerCase().includes(term));
  }, [items, query]);

  const openPlaylist = async (playlist) => {
    setQuery('');
    setNote(null);
    await playlists.select(playlist.id);
  };

  const create = async () => {
    const result = await playlists.create({ title: draftTitle, visibility: draftVisibility });
    if (result?.playlist) {
      setCreating(false);
      setDraftTitle('');
      setTab('mine');
      await openPlaylist(result.playlist);
    }
  };

  const importFromUrl = async () => {
    const result = await playlists.importFromUrl({ input: draftUrl, visibility: draftVisibility });
    if (result?.playlist) {
      setImporting(false);
      setDraftUrl('');
      setTab('mine');
      setNote(`Đã nhập ${result.imported}/${result.declaredCount} video${result.unavailable ? `, ${result.unavailable} video không phát được` : ''}.`);
      await openPlaylist(result.playlist);
    }
  };

  const addByUrl = async () => {
    const raw = addUrl.trim();
    if (!raw || !detail?.editable) return;
    setAdding(true);
    try {
      const data = await privateMediaApi.resolveYouTube(raw);
      if (data?.video) {
        const result = await playlists.addItems(detail.id, [data.video]);
        if (result) { setAddUrl(''); setNote('Đã thêm video vào danh sách phát.'); }
      }
    } catch {
      setNote('Không đọc được link YouTube này.');
    } finally {
      setAdding(false);
    }
  };

  const move = async (index, direction) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await playlists.reorder(detail.id, next.map((item) => item.id));
  };

  const playingId = session?.video?.videoId;
  // Resume bookmark from the server: only offered when the row still exists.
  const resumeItem = detail?.progress?.itemId
    ? items.find((item) => String(item.id) === String(detail.progress.itemId) && item.available)
    : null;

  return (
    <section className="pm-playlists" aria-label="Danh sách phát">
      <div className="pm-playlists__head">
        <h2><ListMusic size={16} aria-hidden="true" /> Danh sách phát</h2>
        <div className="pm-playlists__tools">
          <button type="button" className="pm-link" onClick={() => { setCreating((value) => !value); setImporting(false); }}>
            <Plus size={14} aria-hidden="true" /> Tạo playlist
          </button>
          <button type="button" className="pm-link" onClick={() => { setImporting((value) => !value); setCreating(false); }}>
            <Download size={14} aria-hidden="true" /> Nhập từ YouTube
          </button>
        </div>
      </div>

      {creating && (
        <div className="pm-playlists__form">
          <input
            type="text"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Tên playlist, ví dụ: Nhạc của tôi"
            aria-label="Tên playlist"
            maxLength={120}
          />
          <select value={draftVisibility} onChange={(event) => setDraftVisibility(event.target.value)} aria-label="Phạm vi playlist">
            <option value="private">Riêng tư</option>
            <option value="shared">Chia sẻ trong Nghe chung</option>
          </select>
          <button type="button" className="pm-btn pm-btn--primary" onClick={create} disabled={!draftTitle.trim() || playlists.busy}>
            {playlists.busy ? <Loader2 size={14} className="pm-spin" aria-hidden="true" /> : null} Tạo
          </button>
        </div>
      )}

      {importing && (
        <div className="pm-playlists__form">
          <input
            type="text"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            placeholder="Dán link playlist YouTube (có list=…)"
            aria-label="Link playlist YouTube"
            spellCheck={false}
          />
          <select value={draftVisibility} onChange={(event) => setDraftVisibility(event.target.value)} aria-label="Phạm vi playlist">
            <option value="private">Riêng tư</option>
            <option value="shared">Chia sẻ trong Nghe chung</option>
          </select>
          <button type="button" className="pm-btn pm-btn--primary" onClick={importFromUrl} disabled={!draftUrl.trim() || playlists.busy}>
            {playlists.busy ? <Loader2 size={14} className="pm-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />} Nhập
          </button>
        </div>
      )}

      <div className="pm-tabs" role="tablist" aria-label="Nguồn danh sách phát">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            className={`pm-tab${tab === entry.key ? ' is-active' : ''}`}
            onClick={() => { setTab(entry.key); setQuery(''); }}
          >
            {entry.label}
          </button>
        ))}
        <button type="button" className="pm-tab pm-tab--ghost" onClick={playlists.refresh} aria-label="Làm mới danh sách phát">
          <RefreshCw size={13} aria-hidden="true" />
        </button>
      </div>

      {note && <p className="pm-playlists__note">{note}</p>}

      {!detail && (
        <div className="pm-playlists__grid">
          {playlists.loading && !visible.length && <p className="pm-muted">Đang tải…</p>}
          {!playlists.loading && !visible.length && (
            <p className="pm-muted">
              {tab === 'curated'
                ? 'Danh mục có sẵn chưa được nạp trên máy chủ này.'
                : 'Bạn chưa tạo danh sách phát nào. Bấm “Tạo playlist” để bắt đầu.'}
            </p>
          )}
          {visible.map((playlist) => (
            <button key={playlist.id} type="button" className="pm-playlist-card" onClick={() => openPlaylist(playlist)}>
              <span className="pm-playlist-card__cover" style={playlist.coverUrl ? { backgroundImage: `url(${playlist.coverUrl})` } : undefined}>
                {!playlist.coverUrl && <ListMusic size={20} aria-hidden="true" />}
              </span>
              <span className="pm-playlist-card__body">
                <strong>{playlist.title}</strong>
                <small>
                  {playlist.itemCount} video
                  {playlist.kind === 'curated' ? ` · ${playlist.sourceChannel || 'YouTube'}` : playlist.visibility === 'shared' ? ' · chia sẻ' : ' · riêng tư'}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="pm-playlist-detail">
          <div className="pm-playlist-detail__head">
            <button type="button" className="pm-link" onClick={() => playlists.select(null)}>
              <X size={14} aria-hidden="true" /> Đóng
            </button>
            <div>
              <h3>{detail.title}</h3>
              <small>
                {detail.itemCount} video
                {detail.kind === 'curated' ? ` · ${detail.sourceChannel}` : detail.visibility === 'shared' ? ' · chia sẻ trong Nghe chung' : ' · riêng tư'}
                {detail.kind === 'curated' && detail.expectedCount && detail.itemCount < detail.expectedCount
                  ? ` · còn thiếu ${detail.expectedCount - detail.itemCount}`
                  : ''}
              </small>
            </div>
            <div className="pm-playlist-detail__actions">
              {resumeItem && (
                <button
                  type="button"
                  className="pm-btn pm-btn--primary"
                  disabled={!canPlay || playlists.busy}
                  onClick={() => playlists.play(detail.id, { mode: detail.playbackMode, startItemId: resumeItem.id, repeat: detail.repeatMode })}
                  title={`Tiếp tục từ ${resumeItem.title || resumeItem.videoId}`}
                >
                  <Play size={14} aria-hidden="true" />
                  Tiếp tục {resumeItem.episodeNumber ? `từ Tập ${resumeItem.episodeNumber}` : 'từ chỗ đã nghe'}
                </button>
              )}
              <button
                type="button"
                className={resumeItem ? 'pm-btn' : 'pm-btn pm-btn--primary'}
                disabled={!canPlay || !detail.itemCount || playlists.busy}
                onClick={() => playlists.play(detail.id, { mode: 'sequential', repeat: detail.repeatMode })}
              >
                <Play size={14} aria-hidden="true" /> Phát từ đầu
              </button>
              <button
                type="button"
                className="pm-btn"
                disabled={!canPlay || !detail.itemCount || playlists.busy}
                onClick={() => playlists.play(detail.id, { mode: 'shuffle', repeat: detail.repeatMode })}
              >
                <Shuffle size={14} aria-hidden="true" /> Ngẫu nhiên
              </button>
              <button
                type="button"
                className="pm-btn"
                disabled={!canQueue || !detail.itemCount || playlists.busy}
                onClick={() => playlists.enqueue(detail.id)}
              >
                <Plus size={14} aria-hidden="true" /> Vào hàng chờ
              </button>
              {detail.editable && (
                <button
                  type="button"
                  className="pm-btn pm-btn--danger"
                  disabled={playlists.busy}
                  onClick={async () => {
                    const result = await playlists.remove(detail.id);
                    if (result) setNote('Đã xóa danh sách phát.');
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" /> Xóa
                </button>
              )}
            </div>
          </div>

          {detail.editable && (
            <div className="pm-playlist-detail__add">
              <input
                type="text"
                value={addUrl}
                onChange={(event) => setAddUrl(event.target.value)}
                placeholder="Dán link YouTube để thêm vào playlist này…"
                aria-label="Thêm video bằng link YouTube"
                spellCheck={false}
              />
              <button type="button" className="pm-btn" onClick={addByUrl} disabled={!addUrl.trim() || adding}>
                {adding ? <Loader2 size={14} className="pm-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />} Thêm
              </button>
            </div>
          )}

          <div className="pm-playlist-detail__search">
            <Search size={14} aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={detail.kind === 'curated' && detail.slug === 'conan-1-200' ? 'Tìm tập, ví dụ: 42' : 'Tìm trong playlist'}
              aria-label="Tìm trong playlist"
            />
          </div>

          <ul className="pm-playlist-items">
            {filteredItems.map((item, index) => (
              <li key={item.id} className={`pm-playlist-item${playingId === item.videoId ? ' is-current' : ''}${item.available ? '' : ' is-unavailable'}`}>
                <span className="pm-playlist-item__index">{item.episodeNumber ? `Tập ${item.episodeNumber}` : index + 1}</span>
                <div className="pm-playlist-item__body">
                  <strong title={item.title || item.videoId}>{item.title || item.videoId}</strong>
                  <small>
                    {item.available ? (item.durationSeconds ? formatTime(item.durationSeconds) : 'YouTube') : 'Không thể phát'}
                  </small>
                </div>
                <div className="pm-playlist-item__actions">
                  <button
                    type="button"
                    disabled={!canPlay || !item.available || playlists.busy}
                    aria-label={`Phát ${item.title}`}
                    title="Phát từ video này"
                    onClick={() => playlists.play(detail.id, { mode: detail.playbackMode, startItemId: item.id, repeat: detail.repeatMode })}
                  >
                    <Play size={14} aria-hidden="true" />
                  </button>
                  {detail.editable && (
                    <>
                      <button type="button" disabled={index === 0 || playlists.busy} aria-label="Đưa lên" onClick={() => move(index, -1)}>
                        <ChevronUp size={14} aria-hidden="true" />
                      </button>
                      <button type="button" disabled={index === filteredItems.length - 1 || playlists.busy} aria-label="Đưa xuống" onClick={() => move(index, 1)}>
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Xóa ${item.title}`}
                        disabled={playlists.busy}
                        onClick={() => playlists.removeItem(detail.id, item.id)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
            {!filteredItems.length && <li className="pm-muted">Không có video khớp.</li>}
          </ul>

          {detail.kind === 'curated' && detail.expectedCount && detail.itemCount < detail.expectedCount && (
            <p className="pm-playlists__note">
              Danh mục mới có {detail.itemCount}/{detail.expectedCount} video được xác minh. Phần còn thiếu chưa có nguồn chính thức nên không được thêm vào.
            </p>
          )}
          {permissions.control && detail.editable && (
            <p className="pm-playlists__note">
              Chế độ mặc định khi phát: <strong>{detail.playbackMode === 'shuffle' ? 'Ngẫu nhiên' : 'Tuần tự'}</strong>.
              Dùng nút “Ngẫu nhiên” để đổi cho riêng lần phát này.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
