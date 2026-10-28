import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { users as usersApi } from '../services/api';

/**
 * WR-AUDIT-007 — User picker tìm kiếm phía server.
 *
 * Trước đây AdminSeasons tải toàn bộ 1.210 nhân sự bằng 22 request song song và
 * render select 1.083 option. Component này chỉ gọi API khi người dùng mở picker
 * hoặc gõ tìm kiếm (debounce 280ms, tối đa 20 kết quả).
 */
export default function UserPicker({
  value,
  onChange,
  multiple = false,
  placeholder = 'Tìm theo tên hoặc email…',
  ariaLabel = 'Tìm thành viên',
  allowEmpty = false,
  emptyLabel = '— Không chọn —',
  selectedUsers = [],
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [known, setKnown] = useState(() => new Map((selectedUsers || []).map((u) => [String(u.id), u])));
  const boxRef = useRef(null);
  const requestId = useRef(0);

  const selectedIds = useMemo(() => {
    if (multiple) return Array.isArray(value) ? value.map(String) : [];
    return value ? [String(value)] : [];
  }, [multiple, value]);

  useEffect(() => {
    (selectedUsers || []).forEach((user) => {
      if (user?.id != null) {
        setKnown((prev) => (prev.has(String(user.id)) ? prev : new Map(prev).set(String(user.id), user)));
      }
    });
  }, [selectedUsers]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = setTimeout(async () => {
      const id = requestId.current + 1;
      requestId.current = id;
      setLoading(true);
      try {
        const res = await usersApi.list({ search: query.trim() || undefined, limit: 20, withCount: false });
        if (requestId.current !== id) return;
        const list = res.data || [];
        setResults(list);
        setKnown((prev) => {
          const next = new Map(prev);
          list.forEach((user) => next.set(String(user.id), user));
          return next;
        });
      } catch {
        if (requestId.current === id) setResults([]);
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [open, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const select = useCallback((user) => {
    setKnown((prev) => new Map(prev).set(String(user.id), user));
    if (multiple) {
      const current = Array.isArray(value) ? value.map(String) : [];
      const next = current.includes(String(user.id))
        ? current.filter((id) => id !== String(user.id))
        : [...current, String(user.id)];
      onChange?.(next, [...next].map((id) => known.get(id)).filter(Boolean));
    } else {
      onChange?.(user);
      setOpen(false);
      setQuery('');
    }
  }, [multiple, onChange, value, known]);

  const clear = (id) => {
    if (multiple) {
      const next = (Array.isArray(value) ? value : []).filter((item) => String(item) !== String(id));
      onChange?.(next, next.map((item) => known.get(String(item))).filter(Boolean));
    } else {
      onChange?.(null);
    }
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: selectedIds.length ? 6 : 0 }}>
        {selectedIds.map((id) => {
          const user = known.get(String(id));
          return (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 6, fontSize: 11, color: '#5b21b6', maxWidth: '100%' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user ? `${user.name} · #${user.id}` : `Thành viên #${id}`}</span>
              <button type="button" aria-label={`Bỏ chọn ${user?.name || id}`} onClick={() => clear(id)} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0, color: 'inherit' }}>
                <X size={12} />
              </button>
            </span>
          );
        })}
      </div>

      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="search"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="user-picker-results"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          style={{ width: '100%', padding: '8px 10px 8px 30px', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text-primary)' }}
        />
      </div>

      {open && (
        <div id="user-picker-results" role="listbox" aria-label={ariaLabel} style={{ position: 'absolute', zIndex: 40, left: 0, right: 0, top: '100%', marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 12px 28px rgba(15,23,42,0.16)', maxHeight: 220, overflowY: 'auto' }}>
          {allowEmpty && !multiple && (
            <button type="button" role="option" aria-selected={!value} onClick={() => { onChange?.(null); setOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
              {emptyLabel}
            </button>
          )}
          {loading && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>Đang tìm…</div>}
          {!loading && results.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>Không tìm thấy thành viên phù hợp.</div>}
          {results.map((user) => {
            const selected = selectedIds.includes(String(user.id));
            return (
              <button
                key={user.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => select(user)}
                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', border: 0, borderTop: '1px solid var(--border)', background: selected ? 'rgba(124,58,237,0.06)' : 'transparent', cursor: 'pointer', fontSize: 12, textAlign: 'left', color: 'var(--text-primary)' }}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name} · #{user.id}{user.teamName ? ` · ${user.teamName}` : ''}</span>
                {selected && <span aria-hidden="true" style={{ color: '#7c3aed', fontWeight: 700 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
