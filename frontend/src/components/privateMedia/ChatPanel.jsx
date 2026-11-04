import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, MessageSquare, Send } from 'lucide-react';
import { usePrivateMedia } from '../../context/PrivateMediaContext';

/**
 * CHAT NGHE CHUNG
 *
 * Presentation only. The sender identity, rate limit and persistence live on the
 * server; this component never decides who wrote a message or who may read it.
 *
 * Scroll rules that matter for usability:
 *   - if the reader is at the bottom, new messages follow
 *   - if the reader scrolled up, new messages do NOT yank the view
 *   - the unread counter only grows while the panel is collapsed/out of view
 */

function timeLabel(value) {
  try {
    return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}

export default function ChatPanel({ userId }) {
  const { chat, roomMode } = usePrivateMedia();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpenState] = useState(true);
  const listRef = useRef(null);
  const atBottomRef = useRef(true);

  const registerOpen = chat.setOpen;

  useEffect(() => { registerOpen(open); }, [open, registerOpen]);

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

  useEffect(() => {
    atBottomRef.current = true;
    scrollToBottom('auto');
  }, [roomMode, scrollToBottom]);

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

  return (
    <section className={`pm-chat${open ? '' : ' is-collapsed'}`} aria-label="Chat nghe chung">
      <header className="pm-chat__head">
        <h2>
          <MessageSquare size={15} aria-hidden="true" />
          Chat nghe chung
          {chat.unread > 0 && <em className="pm-chat__badge">{chat.unread > 9 ? '9+' : chat.unread}</em>}
        </h2>
        <button
          type="button"
          className="pm-chat__toggle"
          onClick={() => setOpenState(!open)}
          aria-expanded={open}
          aria-label={open ? 'Thu gọn chat' : 'Mở chat'}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="pm-chat__body">
        <div className="pm-chat__list" ref={listRef} onScroll={onScroll}>
          {chat.hasMore && (
            <button type="button" className="pm-chat__more" onClick={chat.loadMore} disabled={chat.loading}>
              {chat.loading ? <Loader2 size={13} className="pm-spin" aria-hidden="true" /> : null}
              Tải tin nhắn cũ hơn
            </button>
          )}

          {!chat.messages.length && !chat.loading && (
            <div className="pm-chat__empty">
              <MessageSquare size={22} aria-hidden="true" />
              <p>Chưa có tin nhắn nào.</p>
              <span>
                {roomMode === 'shared'
                  ? 'Mọi người trong phiên nghe chung đều thấy tin nhắn này.'
                  : 'Bạn đang nghe riêng — bật “Nghe chung” để trò chuyện cùng người khác.'}
              </span>
            </div>
          )}

          {chat.messages.map((message, index) => {
            const mine = Number(message.user?.id) === Number(userId);
            const previous = chat.messages[index - 1];
            const grouped = previous && Number(previous.user?.id) === Number(message.user?.id)
              && new Date(message.createdAt) - new Date(previous.createdAt) < 120000;
            return (
              <article key={message.id} className={`pm-chat__msg${mine ? ' is-mine' : ''}${grouped ? ' is-grouped' : ''}`}>
                {!grouped && (
                  <div className="pm-chat__meta">
                    <span className="pm-chat__avatar" aria-hidden="true">{initials(message.user?.name)}</span>
                    <strong>{mine ? 'Bạn' : message.user?.name || 'Thành viên'}</strong>
                    <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
                  </div>
                )}
                <p className="pm-chat__text">{message.content}</p>
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
