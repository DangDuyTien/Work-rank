import { useEffect } from 'react';

/**
 * WR-AUDIT-005 — Lớp accessibility dùng chung cho các modal legacy.
 *
 * Nhiều trang tự dựng panel `.modal-dialog-enter` nhưng thiếu role/aria-modal,
 * không đóng bằng Escape và không giữ focus. Một manager duy nhất bổ sung hành vi
 * chuẩn cho mọi modal được mount, thay vì sửa rời rạc 13 file:
 *  - role="dialog" + aria-modal="true" + nhãn lấy từ heading
 *  - Escape đóng qua nút Hủy/Đóng của chính modal
 *  - focus vào modal, Tab bị giữ trong modal, focus trả về nơi mở
 *  - khóa scroll nền
 *
 * Modal đã tự set aria-modal (ui.jsx / UiContext / Groups / ProductTour) được bỏ
 * qua để không xung đột.
 */

const PANEL_SELECTOR = '.modal-dialog-enter';
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function labelFor(panel) {
  const heading = panel.querySelector('h1, h2, h3');
  const text = heading?.textContent?.trim();
  if (text) return text.slice(0, 120);
  return panel.getAttribute('aria-label') || 'Hộp thoại';
}

function closeButtonFor(panel) {
  const buttons = [...panel.querySelectorAll('button')].filter(isVisible);
  const explicit = buttons.find((button) => /^(đóng|đóng lại|hủy|huỷ|quay lại|bỏ qua|tiếp tục chỉnh sửa)$/i.test(button.textContent.trim()));
  if (explicit) return explicit;
  return buttons.find((button) => /đóng|close/i.test(button.getAttribute('aria-label') || '')) || null;
}

function focusables(panel) {
  return [...panel.querySelectorAll(FOCUSABLE)].filter(isVisible);
}

export default function DialogAccessibility() {
  useEffect(() => {
    let active = null;
    let previousFocus = null;
    let previousOverflow = '';

    const deactivate = () => {
      if (!active) return;
      active = null;
      document.body.style.overflow = previousOverflow;
      if (previousFocus && document.contains(previousFocus)) {
        try { previousFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
      }
      previousFocus = null;
    };

    const activate = (panel) => {
      if (active === panel) return;
      if (active) deactivate();
      active = panel;
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      if (!panel.getAttribute('aria-label') && !panel.getAttribute('aria-labelledby')) {
        panel.setAttribute('aria-label', labelFor(panel));
      }
      if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
      document.body.style.overflow = 'hidden';
      const first = focusables(panel)[0] || panel;
      requestAnimationFrame(() => {
        try { first.focus({ preventScroll: true }); } catch { /* ignore */ }
      });
    };

    const sync = () => {
      // Bỏ qua modal đã tự quản lý aria-modal (ui.jsx, UiContext...).
      const panels = [...document.querySelectorAll(PANEL_SELECTOR)]
        .filter((panel) => panel.getAttribute('aria-modal') !== 'true' || panel === active)
        .filter(isVisible);
      const top = panels.at(-1) || null;
      if (top) activate(top);
      else deactivate();
    };

    const onKeyDown = (event) => {
      if (!active || !document.contains(active)) return;
      if (event.key === 'Escape') {
        const close = closeButtonFor(active);
        if (close) {
          event.preventDefault();
          event.stopPropagation();
          close.click();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(active);
      if (!items.length) {
        event.preventDefault();
        active.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = active.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', onKeyDown, true);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onKeyDown, true);
      deactivate();
    };
  }, []);

  return null;
}
