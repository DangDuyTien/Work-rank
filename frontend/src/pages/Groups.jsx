import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groups as groupsApi } from '../services/api';

const CARD = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  padding: 24,
  transition: 'all 0.2s ease',
};

const BUTTON = {
  padding: '10px 20px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  transition: 'all 0.15s ease',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await groupsApi.list();
      setGroups(res.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await groupsApi.create({ name: newName, description: newDesc });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Có lỗi xảy ra');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await groupsApi.join(inviteCode);
      setShowJoin(false);
      setInviteCode('');
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Mã mời không hợp lệ');
    }
  };

  const handleLeave = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn rời nhóm này?')) return;
    try {
      await groupsApi.leave(id);
      fetchGroups();
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Lỗi khi rời nhóm');
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.8px' }}>
            Nhóm <span style={{ color: '#3b82f6', fontStyle: 'italic' }}>Của Tôi</span>
          </h1>
          <p style={{ fontSize: 14, color: '#4b5563', margin: 0, fontWeight: 500 }}>
            Tạo hoặc tham gia nhóm để đua top cùng bạn bè và đồng nghiệp.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowJoin(true)}
            style={{ ...BUTTON, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            Tham Gia Nhóm
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{ ...BUTTON, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            + Tạo Nhóm Mới
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#4b5563' }}>Đang tải danh sách nhóm...</div>
      ) : groups.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>Bạn chưa tham gia nhóm nào</h2>
          <p style={{ fontSize: 14, color: '#4b5563', margin: '0 0 24px' }}>Hãy bắt đầu bằng cách tạo nhóm mới hoặc nhập mã mời từ bạn bè.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {groups.map(g => (
            <div key={g.id} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 8,
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 900, color: '#fff'
                }}>
                  {g.name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{
                  padding: '4px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.2)', fontSize: 10, fontWeight: 700, color: '#3b82f6'
                }}>
                  {g.role === 'owner' ? 'CHỦ NHÓM' : 'THÀNH VIÊN'}
                </div>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>{g.name}</h3>
              <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 16px', lineHeight: 1.5, height: 40, overflow: 'hidden' }}>{g.description || 'Không có mô tả'}</p>
              
              <div style={{ display: 'flex', gap: 16, marginBottom: 20, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Thành viên</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>{g.member_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Mã mời</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>{g.invite_code}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate(`/leaderboard?groupId=${g.id}`)}
                  style={{ ...BUTTON, flex: 1, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                >
                  Xem BXH
                </button>
                {g.role !== 'owner' && (
                  <button
                    onClick={() => handleLeave(g.id)}
                    style={{ ...BUTTON, padding: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  >
                    Rời
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...CARD, width: '100%', maxWidth: 400, background: '#161b22' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px' }}>Tạo Nhóm Mới</h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 8 }}>Tên nhóm *</label>
                <input
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 8 }}>Mô tả</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', height: 80, resize: 'none' }}
                />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ ...BUTTON, flex: 1, background: 'transparent', color: '#4b5563' }}>Hủy</button>
                <button type="submit" style={{ ...BUTTON, flex: 1, background: '#3b82f6', color: '#fff' }}>Tạo Nhóm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...CARD, width: '100%', maxWidth: 400, background: '#161b22' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px' }}>Tham Gia Nhóm</h2>
            <form onSubmit={handleJoin}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 8 }}>Mã mời (Invite Code)</label>
                <input
                  required
                  placeholder="Ví dụ: WR-XXXXXX"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}
                />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setShowJoin(false)} style={{ ...BUTTON, flex: 1, background: 'transparent', color: '#4b5563' }}>Hủy</button>
                <button type="submit" style={{ ...BUTTON, flex: 1, background: '#22c55e', color: '#fff' }}>Tham Gia</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
