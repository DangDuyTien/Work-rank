import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Crown,
  Eye,
  Medal,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trophy,
  UserRound,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import { users as usersApi } from '../services/api';
import { getUserAvatar, initialsFromName } from '../utils/avatar';
import { useToast } from '../context/UiContext';

const FEATURED_BADGE_LIMIT = 4;

const PRIVILEGE_BADGES = [
  { label: 'Tích xanh đặc quyền', icon: BadgeCheck },
  { label: 'Thành viên VIP', icon: Crown },
  { label: 'Đối tác WorkRank', icon: ShieldCheck },
  { label: 'Người nổi bật', icon: Star },
  { label: 'Nhà sáng lập', icon: Trophy },
  { label: 'Hỗ trợ cộng đồng', icon: Medal },
];

const CARD = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.08)',
  borderRadius: 8,
  boxShadow: '0 12px 32px rgba(15,23,42,0.045)',
};

function isVerified(user = {}) {
  return user.isVerified === true || user.verified === true || user.isVerified === 1 || user.verified === 1 || user.isVerified === '1' || user.verified === '1';
}

function Avatar({ user }) {
  const avatar = getUserAvatar(user, user.id);
  return (
    <div style={{
      width: 38,
      height: 38,
      borderRadius: 8,
      overflow: 'hidden',
      background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 900,
      flexShrink: 0,
    }}>
      {avatar ? <img src={avatar} alt={`Ảnh ${user.name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsFromName(user.name || user.email || 'U')}
    </div>
  );
}

function normalizeBadges(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, FEATURED_BADGE_LIMIT) : [];
}

export default function AdminPrivileges() {
  const navigate = useNavigate();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [badgeByUser, setBadgeByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await usersApi.list();
      const list = res.data || [];
      setUsers(list);
      const entries = await Promise.all(list.map(async (user) => {
        try {
          const pref = await usersApi.profilePreferences(user.id);
          return [String(user.id), normalizeBadges(pref.data?.featuredBadges)];
        } catch {
          return [String(user.id), []];
        }
      }));
      setBadgeByUser(Object.fromEntries(entries));
    } catch (err) {
      toast(err.response?.data?.message || 'Không tải được danh sách người dùng.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const haystack = `${user.name || ''} ${user.email || ''} WR-${String(user.id || '').padStart(4, '0')}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (filter === 'verified') return isVerified(user);
      if (filter === 'unverified') return !isVerified(user);
      if (filter === 'bot') return user.isSimulated === true || user.is_simulated === true || user.isSimulated === 1 || user.is_simulated === 1;
      return true;
    });
  }, [filter, query, users]);

  const setUserSaving = (userId, value) => {
    setSaving((current) => ({ ...current, [String(userId)]: value }));
  };

  const toggleVerified = async (user) => {
    const userId = String(user.id);
    const next = !isVerified(user);
    setUserSaving(userId, true);
    setUsers((current) => current.map((item) => (
      String(item.id) === userId ? { ...item, isVerified: next, verified: next } : item
    )));
    try {
      await usersApi.update(user.id, { isVerified: next });
      toast(next ? 'Đã cấp tích xanh.' : 'Đã gỡ tích xanh.', { type: 'success' });
    } catch (err) {
      setUsers((current) => current.map((item) => (
        String(item.id) === userId ? { ...item, isVerified: !next, verified: !next } : item
      )));
      toast(err.response?.data?.message || 'Không cập nhật được tích xanh.', { type: 'error' });
    } finally {
      setUserSaving(userId, false);
    }
  };

  const toggleBadge = async (user, label) => {
    const userId = String(user.id);
    const current = normalizeBadges(badgeByUser[userId]);
    const exists = current.includes(label);
    if (!exists && current.length >= FEATURED_BADGE_LIMIT) {
      toast(`Mỗi hồ sơ chỉ ghim tối đa ${FEATURED_BADGE_LIMIT} huy hiệu.`, { type: 'warning' });
      return;
    }
    const next = exists ? current.filter((item) => item !== label) : [...current, label];
    setUserSaving(userId, true);
    setBadgeByUser((state) => ({ ...state, [userId]: next }));
    try {
      await usersApi.updateProfilePreferences(user.id, { featuredBadges: next });
      toast('Đã cập nhật huy hiệu đặc quyền.', { type: 'success' });
    } catch (err) {
      setBadgeByUser((state) => ({ ...state, [userId]: current }));
      toast(err.response?.data?.message || 'Không cập nhật được huy hiệu.', { type: 'error' });
    } finally {
      setUserSaving(userId, false);
    }
  };

  const verifiedCount = users.filter(isVerified).length;
  const privilegedCount = Object.values(badgeByUser).filter((items) => normalizeBadges(items).length > 0).length;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 16 }}>
      <section style={{ ...CARD, padding: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
            <BadgeCheck size={14} />
            Quản trị đặc quyền
          </div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 28, lineHeight: 1.1, color: '#0f172a' }}>Tích xanh và huy hiệu người dùng</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
            Cấp tích xanh, ghim huy hiệu đặc quyền và mở hồ sơ để kiểm tra hiển thị.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ ...CARD, boxShadow: 'none', padding: '10px 12px', minWidth: 120 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>Tích xanh</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 20, color: '#1877f2' }}>{verifiedCount}</strong>
          </div>
          <div style={{ ...CARD, boxShadow: 'none', padding: '10px 12px', minWidth: 120 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>Có huy hiệu</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 20, color: '#7c3aed' }}>{privilegedCount}</strong>
          </div>
        </div>
      </section>

      <section style={{ ...CARD, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: 260, flex: '1 1 320px' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên, email hoặc WR-0001..."
            style={{ width: '100%', minHeight: 38, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 6, padding: '0 12px 0 34px', outline: 'none', fontSize: 13, fontWeight: 700 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            ['all', 'Tất cả'],
            ['verified', 'Có tích xanh'],
            ['unverified', 'Chưa tích xanh'],
            ['bot', 'Bot'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                minHeight: 34,
                border: '1px solid rgba(15,23,42,0.1)',
                borderRadius: 6,
                background: filter === key ? '#2563eb' : '#ffffff',
                color: filter === key ? '#ffffff' : '#64748b',
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{ minHeight: 34, border: '1px solid rgba(37,99,235,0.16)', borderRadius: 6, background: 'rgba(37,99,235,0.06)', color: '#2563eb', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 900, cursor: loading ? 'wait' : 'pointer' }}
          >
            <RefreshCw size={14} />
            Làm mới
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        {loading ? (
          <div style={{ ...CARD, padding: 40, textAlign: 'center', color: '#64748b', fontWeight: 800 }}>Đang tải danh sách...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ ...CARD, padding: 40, textAlign: 'center', color: '#64748b', fontWeight: 800 }}>Không có người dùng phù hợp.</div>
        ) : filteredUsers.map((user) => {
          const userId = String(user.id);
          const selectedBadges = normalizeBadges(badgeByUser[userId]);
          const pending = Boolean(saving[userId]);
          return (
            <article key={userId} className="admin-privilege-row" style={{ ...CARD, padding: 14, display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(260px, 1.35fr) auto', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <Avatar user={user} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f172a', fontSize: 13, fontWeight: 900 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || `User #${user.id}`}</span>
                    {isVerified(user) && <VerifiedBadge size={14} />}
                  </div>
                  <div style={{ marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: 800 }}>
                    WR-{String(user.id).padStart(4, '0')} · {user.email || 'Không có email'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {PRIVILEGE_BADGES.map((badge) => {
                  const Icon = badge.icon;
                  const active = selectedBadges.includes(badge.label);
                  return (
                    <button
                      key={badge.label}
                      type="button"
                      disabled={pending}
                      onClick={() => toggleBadge(user, badge.label)}
                      title={badge.label}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        minHeight: 30,
                        border: active ? '1px solid rgba(37,99,235,0.34)' : '1px solid rgba(15,23,42,0.1)',
                        borderRadius: 999,
                        background: active ? 'rgba(37,99,235,0.09)' : '#ffffff',
                        color: active ? '#2563eb' : '#64748b',
                        padding: '0 10px',
                        fontSize: 11,
                        fontWeight: 900,
                        cursor: pending ? 'wait' : 'pointer',
                      }}
                    >
                      <Icon size={13} strokeWidth={2.5} />
                      {badge.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleVerified(user)}
                  style={{
                    minHeight: 34,
                    border: isVerified(user) ? '1px solid rgba(24,119,242,0.28)' : '1px solid rgba(15,23,42,0.1)',
                    borderRadius: 6,
                    background: isVerified(user) ? 'rgba(24,119,242,0.08)' : '#ffffff',
                    color: isVerified(user) ? '#1877f2' : '#64748b',
                    padding: '0 11px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: pending ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <BadgeCheck size={14} />
                  {isVerified(user) ? 'Gỡ tích' : 'Cấp tích'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/users/${user.id}`)}
                  style={{
                    width: 34,
                    height: 34,
                    border: '1px solid rgba(15,23,42,0.1)',
                    borderRadius: 6,
                    background: '#ffffff',
                    color: '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Mở hồ sơ"
                >
                  <Eye size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <style>{`
        @media (max-width: 920px) {
          .admin-privilege-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
