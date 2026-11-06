import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell, BellOff, CalendarDays, ChevronDown, Loader2, MessageSquare, Send, Volume2,
} from 'lucide-react';
import DefaultAvatar from '../DefaultAvatar';
import { usePrivateMedia } from '../../context/PrivateMediaContext';
import { playNotificationTing } from '../../utils/mediaNotifications';
import {
  dayHeading, isGrouped, timeLabel,
} from './chatFeed';

/**
 * CHAT CHUNG
 *
 * One system-wide channel: whatever a person writes here is read by everybody,
 * in Nghe riêng and Nghe chung alike. The server owns the sender identity, the
 * rate limit, the persistence and the day boundary; this component never decides
 * who wrote a message or who may read it.
 *
 * Scroll rules that matter for usability:
 *   - if the reader is at the bottom, new messages follow
 *   - if the reader scrolled up, new messages do NOT yank the view
 *   - the unread counter only grows while the panel is collapsed/off-screen
 *   - leaving the page marks the panel closed, so the badge keeps counting
 */
export default function ChatPanel({ userId }) {
  const { chat, notifications, socketConnected } = usePrivateMedia();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpenState] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [permissionNote, setPermissionNote] = useState(null);
  const listRef = useRef(null);
  const atBottomRef = useRef(true);

  const registerOpen = chat.setOpen;

  useEffect(() => {
    registerOpen(open);
    // The panel unmounting means the user cannot see it any more.
    return () => registerOpen(false);
  }, [open, registerOpen]);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);

  // Follow new messages only when the reader is already at the end.
  useEffect(() => {
    if (!atBottomRef.current) return;
    scrollToBottom('smooth');
  }, [chat.messages, scrollToBottom]);

  // A new day starts at the top of an empty feed, not at yesterday's scroll.
  useEffect(() => {
    atBottomRef.current = true;
    scrollToBottom('auto');
  }, [chat.day, scrollToBottom]);

  const onScroll = () => {
    const node = listRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    atBottomRef.current = distance < 48;
    if (atBottomRef.current && chat.unread) chat.markRead();
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const result = await chat.send(text);
    if (result?.ok) {
      setDraft('');
      atBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom('smooth'));
    }
    setSending(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  };

  const prefs = notifications.prefs;
  const permission = notifications.permission;

  const askPermission = async () => {
    const result = await notifications.requestPermission();
    if (result === 'granted') setPermissionNote('Đã bật thông báo trên máy tính.');
    else if (result === 'denied') setPermissionNote('Trình duyệt đã từ chối. Bạn vẫn thấy số tin chưa đọc trên tiêu đề tab.');
    else if (result === 'unsupported') setPermissionNote('Trình duyệt này không hỗ trợ thông báo hệ thống.');
    else setPermissionNote('Chưa cấp quyền thông báo.');
  };

  const day = chat.day || null;
  const heading = dayHeading(day, day);

  return (
    <section className={`pm-chat${open ? '' : ' is-collapsed'}`} aria-label="Chat chung">
      <header className="pm-chat__head">
        <h2>
          <MessageSquare size={15} aria-hidden="true" />
          Chat chung
          {chat.unread > 0 && <em className="pm-chat__badge">{chat.unread > 9 ? '9+' : chat.unread}</em>}
        </h2>
        <div className="pm-chat__head-tools">
          <span
            className={`pm-chat__live${socketConnected ? ' is-live' : ''}`}
            title={socketConnected ? 'Đang nhận tin nhắn trực tiếp' : 'Đang kết nối lại…'}
          >
            <i aria-hidden="true" />
            {socketConnected ? 'Trực tiếp' : 'Ngoại tuyến'}
          </span>
          <button
            type="button"
            className={`pm-chat__toggle pm-chat__toggle--settings${prefs.notify ? '' : ' is-off'}`}
            onClick={() => setSettingsOpen((value) => !value)}
            aria-expanded={settingsOpen}
            aria-label="Cài đặt thông báo tin nhắn"
            title="Cài đặt thông báo"
          >
            {prefs.notify ? <Bell size={15} aria-hidden="true" /> : <BellOff size={15} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="pm-chat__toggle"
            onClick={() => setOpenState(!open)}
            aria-expanded={open}
            aria-label={open ? 'Thu gọn chat' : 'Mở chat'}
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="pm-chat__subhead">
        <span className="pm-chat__day">
          <CalendarDays size={12} aria-hidden="true" />
          {heading || 'Hôm nay'}
        </span>
        <span className="pm-chat__reset" title="Lịch sử chat được làm mới theo ngày, giờ Việt Nam">
          00:00 hằng ngày
        </span>
      </div>

      {settingsOpen && (
        <div className="pm-chat__settings">
          <label className="pm-chat__setting">
            <input
              type="checkbox"
              checked={prefs.notify}
              onChange={(event) => notifications.setPrefs({ notify: event.target.checked })}
            />
            <span>Thông báo tin nhắn</span>
          </label>
          <label className="pm-chat__setting">
            <input
              type="checkbox"
              checked={prefs.sound}
              onChange={(event) => {
                const next = event.target.checked;
                notifications.setPrefs({ sound: next });
                if (next) playNotificationTing(prefs.volume);
              }}
            />
            <span><Volume2 size={13} aria-hidden="true" /> Âm báo</span>
          </label>
          <label className="pm-chat__setting pm-chat__setting--range">
            <span>Âm lượng thông báo</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={prefs.volume}
              aria-label="Âm lượng thông báo"
              onChange={(event) => notifications.setPrefs({ volume: Number(event.target.value) })}
              onMouseUp={() => { if (prefs.sound) playNotificationTing(prefs.volume); }}
            />
            <b>{prefs.volume}%</b>
          </label>
          <div className="pm-chat__setting-row">
            {permission === 'granted' ? (
              <span className="pm-chat__setting-note">Thông báo hệ thống đã bật.</span>
            ) : permission === 'denied' ? (
              <span className="pm-chat__setting-note">Trình duyệt đang chặn thông báo hệ thống.</span>
            ) : (
              <button type="button" className="pm-link" onClick={askPermission}>
                Bật thông báo trên máy tính
              </button>
            )}
          </div>
          {permissionNote && <p className="pm-chat__setting-note">{permissionNote}</p>}
        </div>
      )}

      <div className="pm-chat__body">
        <div className="pm-chat__list" ref={listRef} onScroll={onScroll} role="log" aria-label="Tin nhắn hôm nay">
          {chat.hasMore && (
            <button type="button" className="pm-chat__more" onClick={chat.loadMore} disabled={chat.loading}>
              {chat.loading ? <Loader2 size={13} className="pm-spin" aria-hidden="true" /> : null}
              Tải tin nhắn cũ hơn
            </button>
          )}

          {!chat.messages.length && !chat.loading && (
            <div className="pm-chat__empty">
              <MessageSquare size={22} aria-hidden="true" />
              <p>Hôm nay chưa có tin nhắn nào.</p>
              <span>Mọi người ở cả hai chế độ nghe đều thấy tin nhắn này. Lịch sử tự làm mới lúc 00:00.</span>
            </div>
          )}

          {chat.messages.length > 0 && (
            <div className="pm-chat__divider" role="separator">
              <span>{heading || 'Hôm nay'}</span>
            </div>
          )}

          {chat.messages.map((message, index) => {
            const mine = Number(message.user?.id) === Number(userId);
            const grouped = isGrouped(chat.messages[index - 1], message);
            const name = mine ? 'Bạn' : message.user?.name || 'Thành viên';
            return (
              <article key={message.id} className={`pm-chat__msg${mine ? ' is-mine' : ''}${grouped ? ' is-grouped' : ''}`}>
                <span className="pm-chat__avatar" aria-hidden={grouped ? 'true' : undefined}>
                  {grouped ? null : (
                    <DefaultAvatar
                      src={message.user?.avatarUrl}
                      name={message.user?.name}
                      userId={message.user?.id}
                      size={26}
                      shape="circle"
                      alt={name}
                    />
                  )}
                </span>
                <div className="pm-chat__body-col">
                  {!grouped && (
                    <div className="pm-chat__meta">
                      <strong>{name}</strong>
                      <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
                    </div>
                  )}
                  <p className="pm-chat__text">{message.content}</p>
                </div>
              </article>
            );
          })}
        </div>

        <form className="pm-chat__form" onSubmit={submit}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 1000))}
            onKeyDown={onKeyDown}
            placeholder="Nhắn cho mọi người…"
            aria-label="Nội dung tin nhắn"
            rows={1}
            maxLength={1000}
          />
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Gửi tin nhắn">
            {sending ? <Loader2 size={15} className="pm-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
          </button>
        </form>
        <p className="pm-chat__hint">Enter để gửi · Shift + Enter để xuống dòng</p>
        {chat.error && <p className="pm-chat__error" role="alert">{chat.error}</p>}
      </div>
    </section>
  );
}
