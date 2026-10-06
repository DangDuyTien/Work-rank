import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const UiContext = createContext(null);

const TOAST_ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_COLOR = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--primary)',
};

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [confirmClosing, setConfirmClosing] = useState(false);

  const removeToast = useCallback((id) => {
    setToasts((current) =>
      current.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    );
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 180);
  }, []);

  const toastFn = useCallback((message, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item = {
      id,
      message,
      type: options.type || 'info',
      title: options.title || '',
      isExiting: false,
    };
    setToasts((current) => [...current, item].slice(-4));
    window.setTimeout(() => {
      removeToast(id);
    }, options.duration || 4500);
    return id;
  }, [removeToast]);

  const toast = useMemo(() => {
    const fn = (message, options) => toastFn(message, options);
    fn.success = (message, options = {}) => toastFn(message, { ...options, type: 'success' });
    fn.error = (message, options = {}) => toastFn(message, { ...options, type: 'error' });
    fn.warning = (message, options = {}) => toastFn(message, { ...options, type: 'warning' });
    fn.info = (message, options = {}) => toastFn(message, { ...options, type: 'info' });
    fn.toast = fn;
    return fn;
  }, [toastFn]);

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    setConfirmClosing(false);
    setConfirmState({
      title: options.title || 'Xác nhận thao tác',
      message: options.message || 'Bạn có chắc chắn muốn tiếp tục?',
      confirmText: options.confirmText || 'Xác nhận',
      cancelText: options.cancelText || 'Hủy',
      tone: options.tone || 'danger',
      resolve,
    });
  }), []);

  const closeConfirm = useCallback((result) => {
    setConfirmClosing(true);
    window.setTimeout(() => {
      setConfirmState((current) => {
        if (current?.resolve) current.resolve(result);
        return null;
      });
      setConfirmClosing(false);
    }, 240);
  }, []);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UiContext.Provider value={value}>
      {children}

      {/* ── TOAST NOTIFICATIONS (Editorial, Clean & High-Contrast) ── */}
      <div style={{
        position: 'fixed',
        right: 18,
        top: 70,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 340,
        maxWidth: 'calc(100vw - 32px)',
      }}>
        {toasts.map((item) => {
          const Icon = TOAST_ICON[item.type] || Info;
          const color = TOAST_COLOR[item.type] || TOAST_COLOR.info;
          return (
            <div
              key={item.id}
              role="status"
              className={item.isExiting ? 'motion-toast-exit' : 'motion-toast-enter'}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${color}`,
                borderRadius: 8,
                boxShadow: 'var(--shadow-card-hover)',
                padding: '12px 14px',
              }}
            >
              <Icon size={18} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                {item.title && <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{item.title}</div>}
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>{item.message}</div>
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => removeToast(item.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── CONFIRM DIALOG MODAL (Warm Minimalist Theme) ── */}
      {(confirmState || confirmClosing) && (
        <div
          role="presentation"
          className={confirmClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !confirmClosing) closeConfirm(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2100,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workrank-confirm-title"
            className={confirmClosing ? 'modal-dialog-exit' : 'modal-dialog-enter'}
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-modal)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: confirmState.tone === 'danger' ? 'var(--danger-soft)' : 'var(--surface-active)',
                color: confirmState.tone === 'danger' ? 'var(--danger)' : 'var(--primary)',
                flexShrink: 0,
              }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 id="workrank-confirm-title" style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: 17, fontWeight: 800 }}>
                  {confirmState.title}
                </h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
                  {confirmState.message}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                style={{
                  border: '1px solid var(--border-2)',
                  background: 'var(--surface)',
                  color: 'var(--text-secondary)',
                  borderRadius: 8,
                  padding: '9px 16px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  transition: 'background var(--motion-fast) var(--ease-standard)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
              >
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                style={{
                  border: 'none',
                  background: confirmState.tone === 'danger' ? 'var(--danger)' : 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  borderRadius: 8,
                  padding: '9px 18px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 800,
                  transition: 'background var(--motion-fast) var(--ease-standard)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = confirmState.tone === 'danger' ? '#991b1b' : 'var(--primary-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = confirmState.tone === 'danger' ? 'var(--danger)' : 'var(--primary)';
                }}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useToast must be used within UiProvider');
  return ctx.toast;
}

export function useConfirm() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useConfirm must be used within UiProvider');
  return ctx.confirm;
}
