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
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
  info: '#38bdf8',
};

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const toast = useCallback((message, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item = {
      id,
      message,
      type: options.type || 'info',
      title: options.title || '',
    };
    setToasts((current) => [...current, item].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toastItem) => toastItem.id !== id));
    }, options.duration || 4500);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
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
    setConfirmState((current) => {
      if (current?.resolve) current.resolve(result);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UiContext.Provider value={value}>
      {children}

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
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.12)',
                borderLeft: `4px solid ${color}`,
                borderRadius: 0,
                boxShadow: 'none',
                padding: '12px 12px',
              }}
            >
              <Icon size={18} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                {item.title && <div style={{ color: '#0f172a', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{item.title}</div>}
                <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.45 }}>{item.message}</div>
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => removeToast(item.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
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

      {confirmState && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirm(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2100,
            background: 'rgba(15,23,42,0.42)',
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
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.12)',
              borderRadius: 0,
              boxShadow: 'none',
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: confirmState.tone === 'danger' ? 'rgba(220,38,38,0.1)' : 'rgba(56,189,248,0.1)',
                color: confirmState.tone === 'danger' ? '#dc2626' : '#38bdf8',
                flexShrink: 0,
              }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 id="workrank-confirm-title" style={{ margin: '0 0 6px', color: '#0f172a', fontSize: 18, fontWeight: 900 }}>
                  {confirmState.title}
                </h2>
                <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.55 }}>
                  {confirmState.message}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                style={{
                  border: '1px solid rgba(15,23,42,0.12)',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: 6,
                  padding: '9px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                style={{
                  border: 'none',
                  background: confirmState.tone === 'danger' ? '#dc2626' : '#38bdf8',
                  color: '#ffffff',
                  borderRadius: 6,
                  padding: '9px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 800,
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
